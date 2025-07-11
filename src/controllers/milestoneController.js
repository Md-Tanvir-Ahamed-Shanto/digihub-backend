// src/controllers/milestoneController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js'); // For precise decimal calculations

// --- Admin-specific Milestone Management Routes (requires isAdmin role) ---

exports.createMilestoneByAdmin = async (req, res) => {
    const { projectId, partnerId, title, description, cost, duration, order, dueDate } = req.body;

    if (!projectId || !partnerId || !title || cost === undefined || duration === undefined || order === undefined) {
        return res.status(400).json({ message: "Missing required milestone fields." });
    }

    try {
        // Verify project and partner exist and are linked
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        const partner = await prisma.partner.findUnique({ where: { id: partnerId } });

        if (!project || !partner) {
            return res.status(404).json({ message: "Project or Partner not found." });
        }
        if (project.partnerId !== partnerId) {
            return res.status(400).json({ message: "Assigned partner is not the partner for this project." });
        }

        const newMilestone = await prisma.milestone.create({
            data: {
                projectId,
                partnerId,
                title,
                description,
                cost: new Decimal(cost),
                duration: parseInt(duration, 10),
                status: 'PENDING', // Admin creates as pending
                order: parseInt(order, 10),
                dueDate: dueDate ? new Date(dueDate) : undefined,
                // adminId (approvedBy) will be null until approved
            }
        });
        res.status(201).json({ message: "Milestone created successfully by Admin", milestone: newMilestone });
    } catch (error) {
        console.error("Admin: Create milestone error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllMilestonesForAdmin = async (req, res) => {
    try {
        const milestones = await prisma.milestone.findMany({
            include: {
                project: { select: { id: true, title: true, client: { select: { name: true } } } },
                partner: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                payments: { select: { id: true, status: true, amount: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(milestones);
    } catch (error) {
        console.error("Admin: Get all milestones error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getMilestoneByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const milestone = await prisma.milestone.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, title: true, client: { select: { name: true } } } },
                partner: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                payments: { select: { id: true, status: true, amount: true } },
                invoices: { select: { id: true, status: true, totalAmount: true } }
            },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        res.status(200).json(milestone);
    } catch (error) {
        console.error("Admin: Get milestone by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateMilestoneByAdmin = async (req, res) => {
    const { id } = req.params;
    const { title, description, cost, duration, status, order, dueDate } = req.body;
    try {
        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (cost !== undefined) updateData.cost = new Decimal(cost);
        if (duration !== undefined) updateData.duration = parseInt(duration, 10);
        if (status) updateData.status = status;
        if (order !== undefined) updateData.order = parseInt(order, 10);
        if (dueDate) updateData.dueDate = new Date(dueDate);

        const updatedMilestone = await prisma.milestone.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Milestone updated successfully by Admin", milestone: updatedMilestone });
    } catch (error) {
        console.error("Admin: Update milestone error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Milestone not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.approveMilestoneByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const milestone = await prisma.milestone.findUnique({ where: { id } });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        if (milestone.status === 'APPROVED' || milestone.status === 'COMPLETED' || milestone.status === 'PAID') {
            return res.status(400).json({ message: "Milestone already approved or completed." });
        }

        const approvedMilestone = await prisma.milestone.update({
            where: { id },
            data: {
                status: 'APPROVED',
                adminId: req.user.id, // Admin who approved it
            },
        });

        // After approval, automatically generate an invoice for the client for this milestone
        const project = await prisma.project.findUnique({
            where: { id: approvedMilestone.projectId },
            select: { id: true, clientId: true, gstEnabled: true }
        });

        if (project) {
            const baseAmount = approvedMilestone.cost;
            const gstEnabledForProject = project.gstEnabled;
            const gstAmountForInvoice = gstEnabledForProject ? baseAmount.mul(new Decimal('0.10')) : new Decimal(0);
            const totalAmountForInvoice = baseAmount.add(gstAmountForInvoice);

            await prisma.invoice.create({
                data: {
                    invoiceNumber: `INV-${Date.now()}-${approvedMilestone.id.slice(-6)}`, // Unique invoice number
                    amount: baseAmount,
                    gstAmount: gstAmountForInvoice,
                    totalAmount: totalAmountForInvoice,
                    gstEnabled: gstEnabledForProject,
                    status: 'SENT', // Invoice is sent to client for payment
                    dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Due in 7 days
                    clientId: project.clientId,
                    projectId: project.id,
                    milestoneId: approvedMilestone.id,
                },
            });
        }

        res.status(200).json({ message: "Milestone approved and invoice generated", milestone: approvedMilestone });
    } catch (error) {
        console.error("Admin: Approve milestone error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Milestone not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteMilestoneByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        // Before deleting, consider if there are payments or invoices linked to this milestone
        // Prisma's onDelete behavior will dictate what happens to related records.
        // If 'SET NULL' is used, you just delete the milestone.
        // If 'RESTRICT', you'll need to delete related payments/invoices first.
        await prisma.milestone.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete milestone error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Milestone not found" });
        }
        if (error.code === 'P2003') { // Foreign key constraint error
            return res.status(409).json({ message: "Cannot delete milestone due to existing related payments or invoices. Delete them first." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Partner-specific Milestone Routes (requires isPartner role) ---

exports.getPartnerMilestones = async (req, res) => {
    try {
        const milestones = await prisma.milestone.findMany({
            where: { partnerId: req.user.id },
            include: {
                project: { select: { id: true, title: true, client: { select: { name: true } } } },
                approvedBy: { select: { id: true, name: true } },
                payments: { select: { id: true, status: true, amount: true } }
            },
            orderBy: { order: 'asc' }
        });
        res.status(200).json(milestones);
    } catch (error) {
        console.error("Partner: Get milestones error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerMilestoneById = async (req, res) => {
    const { id } = req.params;
    try {
        const milestone = await prisma.milestone.findUnique({
            where: { id, partnerId: req.user.id }, // Ensure it's assigned to the partner
            include: {
                project: { select: { id: true, title: true, client: { select: { name: true } } } },
                approvedBy: { select: { id: true, name: true } },
                payments: { select: { id: true, status: true, amount: true } }
            },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found or not assigned to you." });
        }
        res.status(200).json(milestone);
    } catch (error) {
        console.error("Partner: Get milestone by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateMilestoneStatusByPartner = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Partner can only update status to 'IN_PROGRESS' or 'COMPLETED'
    if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
        return res.status(400).json({ message: "Invalid status for partner update. Only 'IN_PROGRESS' or 'COMPLETED' allowed." });
    }
    try {
        const milestone = await prisma.milestone.findUnique({
            where: { id, partnerId: req.user.id },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found or not assigned to you." });
        }
        if (milestone.status === 'PAID' || milestone.status === 'APPROVED') {
             return res.status(400).json({ message: "Milestone is already approved/paid and cannot be updated by partner." });
        }

        const updateData = { status };
        if (status === 'COMPLETED' && !milestone.completedAt) {
            updateData.completedAt = new Date();
        }

        const updatedMilestone = await prisma.milestone.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Milestone status updated successfully by Partner", milestone: updatedMilestone });
    } catch (error) {
        console.error("Partner: Update milestone status error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Client-specific Milestone Routes (requires isClient role) ---

exports.getClientMilestones = async (req, res) => {
    const { projectId } = req.query; // Clients might filter by project
    try {
        let whereClause = {
            project: { clientId: req.user.id } // Milestones for client's projects
        };
        if (projectId) {
            whereClause.projectId = projectId;
        }

        const milestones = await prisma.milestone.findMany({
            where: whereClause,
            include: {
                project: { select: { id: true, title: true } },
                partner: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } }
            },
            orderBy: { order: 'asc' }
        });
        res.status(200).json(milestones);
    } catch (error) {
        console.error("Client: Get milestones error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientMilestoneById = async (req, res) => {
    const { id } = req.params;
    try {
        const milestone = await prisma.milestone.findUnique({
            where: {
                id,
                project: { clientId: req.user.id } // Ensure it's for this client's project
            },
            include: {
                project: { select: { id: true, title: true } },
                partner: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } }
            },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found or you don't have access to it." });
        }
        res.status(200).json(milestone);
    } catch (error) {
        console.error("Client: Get milestone by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};