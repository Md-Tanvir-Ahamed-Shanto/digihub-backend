const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const Decimal = require('decimal.js');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const DEFAULT_GST_RATE = parseFloat(process.env.GST_RATE || '0.10');

exports.submitLead = async (req, res) => {
    const { name, email, phone, company, projectCategory, projectTitle, description, features, budgetRange, timeline , clientId } = req.body;

    if (!email || !projectTitle || !description || !budgetRange) {
        return res.status(400).json({ message: "Name, email, phone, project category, project title, description, and budget range are required." });
    }

    try {
        let client;
        const existingClient = await prisma.client.findUnique({ where: { email } });

        if (existingClient) {
            if (existingClient.isEmailVerified && existingClient.isActive) {
                client = existingClient;
            } else {
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

                client = await prisma.client.update({
                    where: { id: existingClient.id },
                    data: {
                        verificationToken,
                        verificationExpires,
                    },
                });
                const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}&role=client`;
                await emailService.sendSetPasswordEmail(email, setPasswordLink, name);
                return res.status(200).json({
                    message: "An unverified account with this email exists. We've resent the account setup link. Please check your email to set your password and activate your account.",
                });
            }
        } else {
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            client = await prisma.client.create({
                data: {
                    name,
                    email,
                    phone,
                    companyName : company,
                    isActive: false,
                    isEmailVerified: false,
                    verificationToken,
                    verificationExpires,
                    password: null,
                },
            });

            const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}&role=client`;
            await emailService.sendSetPasswordEmail(email, setPasswordLink, name);
        }

        const newLead = await prisma.lead.create({
            data: {
                name: name || existingClient.name,
                email,
                phone: phone || existingClient.phone,
                companyName : company || existingClient.companyName,
                projectCategory: projectCategory || "N/A",
                projectTitle,
                description,
                keyFeatures : features || [],
                budgetRange,
                timeline:timeline || "N/A",
                clientId: client.id ||  clientId,
                status: 'PENDING',
            },
        });

        res.status(201).json({
            message: "Project quote submitted successfully! Please check your email to complete your account setup and activate your DIGIHUB AUST account.",
            lead: {
                id: newLead.id,
                email: newLead.email,
                status: newLead.status,
            }
        });

    } catch (error) {
        console.error("Lead submission error:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: "An account with this email already exists. If you already have an account, please login. Otherwise, check your email for the account setup link." });
        }
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.getAllLeads = async (req, res) => {
    try {
        if (!req.user.id) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const leads = await prisma.lead.findMany({
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        isActive: true,
                        isEmailVerified: true,
                    },
                },
                assignedPartner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                processedBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.status(200).json({ success: true, count: leads.length, data: leads });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.getLeadById = async (req, res) => {
    try {
        if (!req.user.id) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const { id } = req.params;

        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        isActive: true,
                        isEmailVerified: true,
                    },
                },
                assignedPartner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        skillSet: true,
                        industryExp: true,
                        hourlyRate: true,
                    },
                },
                processedBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        offerPrice: true,
                        partnerCost: true,
                        adminMargin: true,
                        includesGST: true,
                    }
                }
            },
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        res.status(200).json({ success: true, data: lead });
    } catch (error) {
        console.error('Error fetching lead by ID:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.assignPartnerToLead = async (req, res) => {
    try {
        const adminId = req.user.id;
        if (!adminId) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const { id } = req.params;
        const { partnerId , partnerProposedCost ,notes, timeline} = req.body;

        if (!partnerId) {
            return res.status(400).json({ success: false, message: 'Partner ID is required.' });
        }

        const existingLead = await prisma.lead.findUnique({ where: { id } });
        if (!existingLead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        const existingPartner = await prisma.partner.findUnique({ where: { id: partnerId } });
        if (!existingPartner) {
            return res.status(404).json({ success: false, message: 'Partner not found.' });
        }

        if (['ACCEPTED_AND_CONVERTED', 'OFFER_SENT_TO_CLIENT', 'OFFER_REJECTED_BY_CLIENT'].includes(existingLead.status)) {
            return res.status(400).json({ success: false, message: `Cannot assign partner to lead with status: ${existingLead.status}.` });
        }

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                assignedPartnerId: partnerId,
                processedById: adminId,
                partnerProposedCost: partnerProposedCost,
                timeline: timeline,
                notes:notes,
                status: 'ASSIGNED_TO_PARTNER',
            },
            include: {
                assignedPartner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (existingPartner.email) {
            await emailService.sendPartnerSetPasswordEmail(
                existingPartner.email,
                `${FRONTEND_URL}/partner/leads/${updatedLead.id}`,
                existingPartner.name
            );
        }

        res.status(200).json({ success: true, message: 'Partner assigned to lead successfully.', data: updatedLead });
    } catch (error) {
        console.error('Error assigning partner to lead:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.updateLeadStatus = async (req, res) => {
    try {
        const adminId = req.user.id;
        if (!adminId) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'New status is required.' });
        }

        const validStatuses = ['PENDING', 'REVIEWING', 'ASSIGNED_TO_PARTNER', 'PENDING_OFFER_REVIEW', 'OFFER_SENT_TO_CLIENT', 'OFFER_REJECTED_BY_CLIENT', 'ACCEPTED_AND_CONVERTED', 'ARCHIVED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status provided. Must be one of: ${validStatuses.join(', ')}` });
        }

        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                status: status,
                processedById: adminId,
            },
            include: { client: true, assignedPartner: true, processedBy: true }
        });

        res.status(200).json({ success: true, message: 'Lead status updated successfully.', data: updatedLead });

    } catch (error) {
        console.error('Error updating lead status:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.updateLeadByAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, companyName, projectCategory, projectTitle, description, keyFeatures, budgetRange, timeline, status, assignedPartnerId } = req.body;

    try {
        if (!req.user.id) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (companyName !== undefined) updateData.companyName = companyName;
        if (projectCategory) updateData.projectCategory = projectCategory;
        if (projectTitle) updateData.projectTitle = projectTitle;
        if (description) updateData.description = description;
        if (keyFeatures !== undefined) updateData.keyFeatures = keyFeatures;
        if (budgetRange) updateData.budgetRange = budgetRange;
        if (timeline !== undefined) updateData.timeline = timeline;
        if (status) {
            const validStatuses = ['PENDING', 'REVIEWING', 'ASSIGNED_TO_PARTNER', 'PENDING_OFFER_REVIEW', 'OFFER_SENT_TO_CLIENT', 'OFFER_REJECTED_BY_CLIENT', 'ACCEPTED_AND_CONVERTED', 'ARCHIVED'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: `Invalid status provided. Must be one of: ${validStatuses.join(', ')}` });
            }
            updateData.status = status;
        }
        if (assignedPartnerId) updateData.assignedPartnerId = assignedPartnerId;
        updateData.processedById = req.adminId;

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: updateData,
            include: {
                client: {
                    select: { id: true, name: true, email: true }
                },
                assignedPartner: {
                    select: { id: true, name: true }
                },
                processedBy: {
                    select: { id: true, name: true }
                }
            }
        });
        res.status(200).json({ message: "Lead updated successfully by Admin", lead: updatedLead });
    } catch (error) {
        console.error("Admin: Update lead error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Lead not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteLeadByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.user.id) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const lead = await prisma.lead.findUnique({
            where: { id },
            select: { projectId: true }
        });

        if (lead && lead.projectId) {
            return res.status(409).json({ message: "Cannot delete lead. It has already been converted to a project. Consider archiving instead." });
        }

        await prisma.lead.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete lead error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Lead not found" });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ message: "Cannot delete lead due to existing related data (e.g., foreign key constraint). Consider soft deleting or manually removing relationships." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};





// --- Admin Finalizes and Sends Offer to Client ---
exports.sendOfferToClient = async (req, res) => {
    const { leadId } = req.params;
    const { adminMargin, includesGST, timeline, notes } = req.body; // Input from Admin

    try {
        const adminId = req.user.id; // From authMiddleware (assuming admin role)

        if (!adminId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        if (typeof adminMargin === 'undefined' || adminMargin === null) {
            return res.status(400).json({ success: false, message: "Admin margin is required." });
        }
        const numericAdminMargin = new Decimal(adminMargin);
        if (numericAdminMargin.lessThan(0)) {
            return res.status(400).json({ success: false, message: "Admin margin cannot be negative." });
        }
        if (!timeline) {
            return res.status(400).json({ success: false, message: "Timeline is required!" });
        }
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                status: true,
                partnerProposedCost: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                projectTitle: true, // Still using 'projectTitle' as per your schema
                budgetRange: true
            }
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found." });
        }

        // Allow if partner has proposed an offer or it's just assigned
        if (!['ASSIGNED_TO_PARTNER', 'PARTNER_OFFER_PROPOSED','OFFER_REJECTED_BY_CLIENT'].includes(lead.status)) {
            return res.status(400).json({ success: false, message: `Cannot send offer for lead with status: ${lead.status}. Lead must have a partner offer proposed or be assigned.` });
        }

        if (lead.partnerProposedCost === null) {
            return res.status(400).json({ success: false, message: "Partner's proposed cost is missing. Cannot finalize client offer." });
        }

        const basePrice = lead.partnerProposedCost.plus(numericAdminMargin);
        let finalClientOffer = basePrice;
        const gstRate = new Decimal(DEFAULT_GST_RATE);

        if (includesGST) {
            finalClientOffer = basePrice.times(Decimal.add(1, gstRate));
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                adminMargin: numericAdminMargin,
                includesGST: includesGST,
                // FIX: Changed clientOfferPrice to offerPrice as per your schema
                offerPrice: finalClientOffer,
                timeline,
                notes, // Pass notes from req.body to the lead
                adminOfferPreparedAt: new Date(),
                status: 'OFFER_SENT_TO_CLIENT',
                processedById: adminId // Record which admin sent the offer
            },
            select: {
                id: true,
                projectTitle: true, // Still using 'projectTitle' as per your schema
                // FIX: Changed clientOfferPrice to offerPrice as per your schema
                offerPrice: true,
                includesGST: true,
                status: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        console.log("updatedLead", updatedLead);

        // --- Send Offer Email to Client ---
        if (updatedLead.client && updatedLead.client.email) {
            const offerLink = `${FRONTEND_URL}/client/offers/${updatedLead.id}`; // Assuming client can view offer details here
            await emailService.sendProjectOfferToClient(
                updatedLead.client.email,
                updatedLead.client.name,
                updatedLead.projectTitle, // Still using 'projectTitle' as per your schema
                // FIX: Changed clientOfferPrice to offerPrice for email formatting
                updatedLead.offerPrice.toFixed(2),
                offerLink,
                'We have carefully reviewed your project requirements and designed an offer that best fits your needs.'
            );
        }

        res.status(200).json({
            success: true,
            message: `Offer for Lead ${leadId} finalized and sent to client successfully.`,
            data: updatedLead
        });

    } catch (error) {
        console.error("Error sending offer to client:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
};

// --- Client Accepts Offer ---
exports.clientAcceptOffer = async (req, res) => {
    try {
        const clientId = req.user.id;
        if (!clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. Client authentication required.' });
        }

        const { id } = req.params; // leadId
        // console.log("id", id); // Removed console.log for final code

        // Fetch lead with all necessary details for project creation and email notifications
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                client: true,
                assignedPartner: true,
                processedBy: true // The admin who processed this lead
            }
        });

        // console.log("lead ", lead); // Removed console.log for final code
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        // Authorization check: Ensure the authenticated client owns this lead
        if (lead.clientId !== clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You are not the client for this lead.' });
        }

        // Business logic validation: Only allow acceptance if status is 'OFFER_SENT_TO_CLIENT'
        if (lead.status !== 'OFFER_SENT_TO_CLIENT') {
            return res.status(400).json({ success: false, message: `Offer cannot be accepted. Current lead status is "${lead.status}".` });
        }

        // Validate that all necessary offer details and assignments exist before creating project
        // Note: partnerCost should be set during 'OFFER_SENT_TO_CLIENT' status.
        if (
            lead.offerPrice === null || // Ensure offerPrice is not null
            lead.partnerProposedCost === null || // ⭐ Corrected: Check for partnerCost being null
            lead.adminMargin === null || // Ensure adminMargin is not null
            !lead.assignedPartnerId ||
            !lead.processedById ||
            !lead.description ||
            !lead.projectCategory ||
            !lead.timeline
        ) {
            return res.status(400).json({ success: false, message: 'Missing offer details or required lead information for project creation. Please contact support.' });
        }

        let newProject; // Declare newProject outside the transaction scope

        const transactionResult = await prisma.$transaction(async (tx) => {
            // Create the new project
            newProject = await tx.project.create({
                data: {
                    title: lead.projectTitle, // ⭐ Fixed: Using porjectTitle to match schema
                    description: lead.description,
                    projectCategory: lead.projectCategory,
                    budget: lead.budgetRange, // Assuming budgetRange from lead maps to budget in project
                    timeline: lead.timeline,
                    offerPrice: lead.offerPrice,
                    partnerCost: lead.partnerProposedCost, // This should now be populated
                    adminMargin: lead.adminMargin,
                    includesGST: lead.includesGST,
                    clientId: lead.clientId,
                    partnerId: lead.assignedPartnerId,
                    leadId: lead.id,
                    createdByAdminId: lead.processedById, // This maps to the admin who sent the offer
                    status: 'ACTIVE', // Initial project status (user's change retained)
                    acceptedAt: new Date(),
                }
            });

            // Update the lead status and link to the new project
            const updatedLead = await tx.lead.update({
                where: { id: lead.id },
                data: {
                    status: 'ACCEPTED_AND_CONVERTED',
                    projectId: newProject.id, // Link the lead to the new project
                },
            });

            // Return necessary data from the transaction to be used outside
            return { newProject, updatedLead };
        });

        // ⭐⭐⭐ All email sending moved OUTSIDE the transaction ⭐⭐⭐
        // These will execute only if the database operations above successfully committed.

        // Send Project Accepted Confirmation Email to Client
        if (lead.client && lead.client.email) {
            await emailService.sendProjectAcceptedConfirmation(
                lead.client.email,
                lead.client.name,
                transactionResult.newProject.title // Use title from the newly created project
            );
        }

        const projects = {
            ...transactionResult.newProject,
            partnerCost: null,
            adminMargin: null,
        }

        // Notify Assigned Partner about the new project
        if (lead.assignedPartner && lead.assignedPartner.email) {
            await emailService.sendEmail({ // Using generic sendEmail for custom content
                to: lead.assignedPartner.email,
                subject: `New Project Alert: Offer Accepted for "${transactionResult.newProject.title}"`,
                html: `
                    <p>Dear ${lead.assignedPartner.name},</p>
                    <p>Great news! The client has accepted the offer for project <strong>"${transactionResult.newProject.title}"</strong> (Lead ID: ${lead.id}).</p>
                    <p>The project is now active and in 'ACTIVE' status.</p>
                    <p>View Project: <a href="${FRONTEND_URL}/partner/projects/${transactionResult.newProject.id}">Link to Project</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `
            });
        }

        // Notify Admin about the accepted offer and new project
        if (lead.processedBy && lead.processedBy.email) {
            await emailService.sendEmail({ // Using generic sendEmail for custom content
                to: lead.processedBy.email,
                subject: `Offer Accepted & Project Created for Lead: "${transactionResult.newProject.title}"`,
                html: `
                    <p>Dear ${lead.processedBy.name},</p>
                    <p>The offer you sent for project <strong>"${transactionResult.newProject.title}"</strong> (Lead ID: ${lead.id}) has been accepted by the client <strong>${lead.client.name}</strong>.</p>
                    <p>A new project (ID: ${transactionResult.newProject.id}) has been successfully created and linked to this lead.</p>
                    <p>View Project: <a href="${FRONTEND_URL}/admin/projects/${transactionResult.newProject.id}">Link to Project</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `
            });
        }

        res.status(200).json({
            success: true,
            message: 'Offer accepted and project created successfully!',
            project: projects // Send the created project details in the response
        });

    } catch (error) {
        console.error('Error accepting offer and converting to project:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Updated exports.clientRejectsOffer
exports.clientRejectsOffer = async (req, res) => {
    try {
        const clientId = req.user.id;
        if (!clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. Client authentication required.' });
        }

        const { id } = req.params;
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: { client: true, assignedPartner: true, processedBy: true }
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        if (lead.clientId !== clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You are not the client for this lead.' });
        }

        if (lead.status !== 'OFFER_SENT_TO_CLIENT') {
            return res.status(400).json({ success: false, message: `Offer cannot be rejected. Current lead status is "${lead.status}".` });
        }

        const updatedLead = await prisma.lead.update({
            where: { id: lead.id },
            data: {
                status: 'OFFER_REJECTED_BY_CLIENT',
            },
            include: { client: true, assignedPartner: true, processedBy: true } // Include relations for email notifications
        });

        // Send Rejection Confirmation Email to Client
        if (updatedLead.client && updatedLead.client.email) {
            await emailService.sendProjectRejectedNotification(
                updatedLead.client.email,
                updatedLead.client.name,
                updatedLead.projectTitle // Corrected typo
            );
        }

        // Notify Admin that client rejected the offer
        if (updatedLead.processedBy && updatedLead.processedBy.email) {
            await emailService.sendEmail({ // Using generic sendEmail for custom content
                to: updatedLead.processedBy.email,
                subject: `Offer Rejected by Client for Lead: "${updatedLead.projectTitle}"`,
                html: `
                    <p>Dear ${updatedLead.processedBy.name},</p>
                    <p>The client <strong>${updatedLead.client.name}</strong> has rejected the offer for project <strong>"${updatedLead.projectTitle}"</strong> (Lead ID: ${updatedLead.id}).</p>
                  
                    <p>View Lead: <a href="${FRONTEND_URL}/admin/leads/${updatedLead.id}">Link to Lead</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `
            });
        }

        // Notify Assigned Partner that client rejected the offer
        if (updatedLead.assignedPartner && updatedLead.assignedPartner.email) {
            await emailService.sendEmail({ // Using generic sendEmail for custom content
                to: updatedLead.assignedPartner.email,
                subject: `Offer Rejected by Client for Lead: "${updatedLead.projectTitle}"`,
                html: `
                    <p>Dear ${updatedLead.assignedPartner.name},</p>
                    <p>The client has rejected the offer for lead <strong>"${updatedLead.projectTitle}"</strong> (Lead ID: ${updatedLead.id}).</p>
                 
                    <p>View Lead: <a href="${FRONTEND_URL}/partner/leads/${updatedLead.id}">Link to Lead</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `
            });
        }

        res.status(200).json({ success: true, message: 'Offer rejected successfully.', data: updatedLead });

    } catch (error) {
        console.error('Error rejecting offer:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
