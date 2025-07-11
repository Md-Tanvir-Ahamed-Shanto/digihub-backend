// src/controllers/supportController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- Client-Specific Support Ticket/Response Routes ---

exports.createSupportTicketByClient = async (req, res) => {
    const { subject, message, projectId } = req.body;
    const clientId = req.user.id;

    if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required for a new support ticket." });
    }

    try {
        const newTicket = await prisma.supportTicket.create({
            data: {
                subject,
                message,
                clientId,
                projectId: projectId || null, // Optional project association
                status: 'OPEN',
                priority: 'MEDIUM', // Default priority for client created tickets
            },
        });
        res.status(201).json({ message: "Support ticket created successfully", ticket: newTicket });
    } catch (error) {
        console.error("Client: Create support ticket error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientSupportTickets = async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where: { clientId: req.user.id },
            include: {
                project: { select: { id: true, title: true } },
                assignedTo: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } },
                _count: {
                    select: { responses: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Client: Get support tickets error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientSupportTicketById = async (req, res) => {
    const { id } = req.params;
    try {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id, clientId: req.user.id }, // Ensure ticket belongs to the client
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
                responses: {
                    orderBy: { createdAt: 'asc' },
                    select: { id: true, message: true, isAdmin: true, createdAt: true }
                }
            },
        });
        if (!ticket) {
            return res.status(404).json({ message: "Support ticket not found or you don't have access to it." });
        }
        res.status(200).json(ticket);
    } catch (error) {
        console.error("Client: Get support ticket by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.addResponseByClient = async (req, res) => {
    const { id } = req.params; // Ticket ID
    const { message } = req.body;
    const clientId = req.user.id;

    if (!message) {
        return res.status(400).json({ message: "Message is required for a response." });
    }

    try {
        // Verify the ticket exists and belongs to the client
        const ticket = await prisma.supportTicket.findUnique({
            where: { id, clientId },
        });

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found or does not belong to you." });
        }

        const newResponse = await prisma.supportResponse.create({
            data: {
                message,
                isAdmin: false, // Client response
                ticketId: id,
            },
        });

        // If ticket was closed, re-open it when client responds (optional)
        if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
            await prisma.supportTicket.update({
                where: { id },
                data: { status: 'OPEN', updatedAt: new Date() }
            });
        }

        res.status(201).json({ message: "Response added successfully", response: newResponse });
    } catch (error) {
        console.error("Client: Add response error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Partner-Specific Support Ticket/Response Routes ---

exports.getPartnerAssignedTickets = async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where: {
                OR: [
                    { assignedTo: { id: req.user.id } }, // Tickets directly assigned to the partner
                    { projectId: { in: await prisma.project.findMany({ // Tickets for projects partner is assigned to
                        where: { assignedToId: req.user.id }, select: { id: true }
                    }).then(projects => projects.map(p => p.id)) } }
                ]
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                _count: {
                    select: { responses: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Partner: Get assigned tickets error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerSupportTicketById = async (req, res) => {
    const { id } = req.params;
    try {
        // Ensure the partner is either assigned to the ticket directly or to the related project
        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true, assignedToId: true } },
                assignedTo: { select: { id: true } }, // To check if directly assigned
                responses: {
                    orderBy: { createdAt: 'asc' },
                    select: { id: true, message: true, isAdmin: true, createdAt: true }
                }
            },
        });

        if (!ticket) {
            return res.status(404).json({ message: "Support ticket not found." });
        }

        const isAssignedToPartner = ticket.assignedTo?.id === req.user.id;
        const isProjectAssignedToPartner = ticket.project?.assignedToId === req.user.id;

        if (!isAssignedToPartner && !isProjectAssignedToPartner) {
            return res.status(403).json({ message: "You don't have access to this ticket." });
        }

        res.status(200).json(ticket);
    } catch (error) {
        console.error("Partner: Get ticket by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateSupportTicketByPartner = async (req, res) => {
    const { id } = req.params;
    const { status, priority } = req.body; // Partner can update status and priority

    try {
        // Verify partner is assigned to the ticket or related project
        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            select: { id: true, assignedToId: true, projectId: true, project: { select: { assignedToId: true } } }
        });

        if (!ticket) {
            return res.status(404).json({ message: "Support ticket not found." });
        }
        const isAssignedToPartner = ticket.assignedToId === req.user.id;
        const isProjectAssignedToPartner = ticket.project?.assignedToId === req.user.id;

        if (!isAssignedToPartner && !isProjectAssignedToPartner) {
            return res.status(403).json({ message: "You don't have permission to update this ticket." });
        }

        const updateData = {};
        if (status) updateData.status = status;
        if (priority) updateData.priority = priority;

        // Automatically assign partner if ticket is being updated by a partner and not yet assigned
        if (!ticket.assignedToId && !ticket.projectId) { // If it's a general ticket not linked to a project or specific partner
            updateData.assignedToId = req.user.id;
            updateData.status = updateData.status || 'IN_PROGRESS'; // Default to IN_PROGRESS if no status provided
        } else if (!ticket.assignedToId && ticket.projectId && !isProjectAssignedToPartner) {
            // If project is linked, but not assigned to this partner and ticket not assigned, do not auto-assign.
            // This case implies an admin must assign it.
        } else if (ticket.assignedToId !== req.user.id && ticket.projectId && ticket.project.assignedToId !== req.user.id) {
             return res.status(403).json({ message: "You can only update tickets assigned to you or your projects." });
        }


        const updatedTicket = await prisma.supportTicket.update({
            where: { id },
            data: updateData,
        });

        res.status(200).json({ message: "Support ticket updated successfully", ticket: updatedTicket });
    } catch (error) {
        console.error("Partner: Update support ticket error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.addResponseByPartner = async (req, res) => {
    const { id } = req.params; // Ticket ID
    const { message } = req.body;
    const partnerId = req.user.id;

    if (!message) {
        return res.status(400).json({ message: "Message is required for a response." });
    }

    try {
        // Verify the ticket exists and is assigned to the partner or their project
        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            select: { id: true, assignedToId: true, projectId: true, project: { select: { assignedToId: true } } }
        });

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found." });
        }
        const isAssignedToPartner = ticket.assignedToId === partnerId;
        const isProjectAssignedToPartner = ticket.project?.assignedToId === partnerId;

        if (!isAssignedToPartner && !isProjectAssignedToPartner) {
            return res.status(403).json({ message: "You don't have permission to respond to this ticket." });
        }

        const newResponse = await prisma.supportResponse.create({
            data: {
                message,
                isAdmin: false, // Partner response (not an admin)
                ticketId: id,
            },
        });

        // Set ticket status to IN_PROGRESS if it was OPEN and partner responds
        if (ticket.status === 'OPEN') {
            await prisma.supportTicket.update({
                where: { id },
                data: { status: 'IN_PROGRESS', updatedAt: new Date() }
            });
        }

        res.status(201).json({ message: "Response added successfully", response: newResponse });
    } catch (error) {
        console.error("Partner: Add response error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Admin-Specific Support Ticket/Response Routes ---

exports.createSupportTicketByAdmin = async (req, res) => {
    const { clientId, projectId, subject, message, status, priority, assignedToId } = req.body;
    const adminId = req.user.id;

    if (!clientId || !subject || !message) {
        return res.status(400).json({ message: "Client ID, Subject, and Message are required." });
    }

    try {
        const newTicket = await prisma.supportTicket.create({
            data: {
                clientId,
                projectId: projectId || null,
                subject,
                message,
                status: status || 'OPEN',
                priority: priority || 'MEDIUM',
                assignedToId: assignedToId || null,
                reviewedBy: { connect: { id: adminId } }, // Admin who created/reviewed it
            },
        });
        res.status(201).json({ message: "Support ticket created by Admin successfully", ticket: newTicket });
    } catch (error) {
        console.error("Admin: Create support ticket error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


exports.getAllSupportTicketsForAdmin = async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                assignedTo: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } },
                _count: {
                    select: { responses: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Admin: Get all support tickets error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getSupportTicketByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
                responses: {
                    orderBy: { createdAt: 'asc' },
                    select: { id: true, message: true, isAdmin: true, createdAt: true }
                }
            },
        });
        if (!ticket) {
            return res.status(404).json({ message: "Support ticket not found" });
        }
        res.status(200).json(ticket);
    } catch (error) {
        console.error("Admin: Get support ticket by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateSupportTicketByAdmin = async (req, res) => {
    const { id } = req.params;
    const { subject, message, status, priority, assignedToId, projectId } = req.body; // Admin can update more fields
    const adminId = req.user.id;

    try {
        const updateData = {};
        if (subject) updateData.subject = subject;
        if (message) updateData.message = message;
        if (status) updateData.status = status;
        if (priority) updateData.priority = priority;
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null; // Allow unassigning
        if (projectId !== undefined) updateData.projectId = projectId || null; // Allow unlinking project
        updateData.adminId = adminId; // Admin who last reviewed/updated it

        const updatedTicket = await prisma.supportTicket.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Support ticket updated by Admin successfully", ticket: updatedTicket });
    } catch (error) {
        console.error("Admin: Update support ticket error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Support ticket not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteSupportTicketByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        // Deleting a ticket will cascade delete its responses if your schema is set up with onDelete: Cascade
        await prisma.supportTicket.delete({ where: { id } });
        res.status(204).send(); // No content
    } catch (error) {
        console.error("Admin: Delete support ticket error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Support ticket not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.addResponseByAdmin = async (req, res) => {
    const { id } = req.params; // Ticket ID
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ message: "Message is required for a response." });
    }

    try {
        const newResponse = await prisma.supportResponse.create({
            data: {
                message,
                isAdmin: true, // Admin response
                ticketId: id,
            },
        });

        // Set ticket status to IN_PROGRESS if it was OPEN when admin responds
        await prisma.supportTicket.update({
            where: { id },
            data: {
                status: 'IN_PROGRESS', // Or OPEN depending on your flow. Generally, it's now IN_PROGRESS
                updatedAt: new Date(),
                reviewedBy: { connect: { id: req.user.id } } // Admin who last responded
            }
        });

        res.status(201).json({ message: "Admin response added successfully", response: newResponse });
    } catch (error) {
        console.error("Admin: Add response error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Ticket not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

// Admin can get all responses for a ticket
exports.getTicketResponsesForAdmin = async (req, res) => {
    const { id } = req.params; // Ticket ID
    try {
        const responses = await prisma.supportResponse.findMany({
            where: { ticketId: id },
            orderBy: { createdAt: 'asc' },
        });
        if (!responses) {
            return res.status(404).json({ message: "Responses not found for this ticket." });
        }
        res.status(200).json(responses);
    } catch (error) {
        console.error("Admin: Get ticket responses error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};