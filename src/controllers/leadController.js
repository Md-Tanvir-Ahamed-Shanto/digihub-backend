const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const Decimal = require('decimal.js');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DEFAULT_GST_RATE = parseFloat(process.env.GST_RATE || '0.18');

exports.submitLead = async (req, res) => {
    const { name, email, phone, companyName, projectCategory, porjectTitle, description, keyFeatures, budgetRange, timeline } = req.body;

    if (!name || !email || !phone || !projectCategory || !porjectTitle || !description || !budgetRange) {
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
                const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
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
                    companyName,
                    isActive: false,
                    isEmailVerified: false,
                    verificationToken,
                    verificationExpires,
                    password: null,
                },
            });

            const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
            await emailService.sendSetPasswordEmail(email, setPasswordLink, name);
        }

        const newLead = await prisma.lead.create({
            data: {
                name,
                email,
                phone,
                companyName,
                projectCategory,
                porjectTitle,
                description,
                keyFeatures,
                budgetRange,
                timeline,
                clientId: client.id,
                status: 'PENDING',
            },
        });

        res.status(201).json({
            message: "Project quote submitted successfully! Please check your email to complete your account setup and activate your DGHUB account.",
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
        const { partnerId } = req.body;

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

exports.setOfferPriceAndSend = async (req, res) => {
    try {
        const adminId = req.user.id;
        if (!adminId) {
            return res.status(403).json({ message: 'Access denied. Admin authentication required.' });
        }

        const { id } = req.params;
        const { partnerCost, adminMarginPercentage, includesGST = false, notes } = req.body;

        if (partnerCost === undefined || adminMarginPercentage === undefined) {
            return res.status(400).json({ success: false, message: 'Partner cost and Admin margin percentage are required.' });
        }
        if (isNaN(parseFloat(partnerCost)) || isNaN(parseFloat(adminMarginPercentage))) {
            return res.status(400).json({ success: false, message: 'Partner cost and Admin margin percentage must be numbers.' });
        }

        const lead = await prisma.lead.findUnique({
            where: { id },
            include: { client: true, assignedPartner: true }
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        if (lead.status !== 'ASSIGNED_TO_PARTNER' && lead.status !== 'PENDING_OFFER_REVIEW') {
            return res.status(400).json({ success: false, message: `Offer can only be set for leads with status 'ASSIGNED_TO_PARTNER' or 'PENDING_OFFER_REVIEW'. Current status: ${lead.status}` });
        }

        if (!lead.assignedPartnerId) {
            return res.status(400).json({ success: false, message: 'Cannot set offer. A partner must be assigned to this lead first.' });
        }

        const pCost = new Decimal(partnerCost);
        const adminMarginDecimal = pCost.times(new Decimal(adminMarginPercentage).dividedBy(100));
        let offerPrice = pCost.plus(adminMarginDecimal);
        let gstAmount = new Decimal(0);

        if (includesGST) {
            gstAmount = offerPrice.times(new Decimal(DEFAULT_GST_RATE));
            offerPrice = offerPrice.plus(gstAmount);
        }

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                offerPrice: offerPrice.toDecimalPlaces(2),
                partnerCost: pCost.toDecimalPlaces(2),
                adminMargin: adminMarginDecimal.toDecimalPlaces(2),
                includesGST: includesGST,
                notes: notes || lead.notes,
                status: 'OFFER_SENT_TO_CLIENT',
                processedById: adminId,
            },
            include: { client: true, assignedPartner: true }
        });

        if (updatedLead.client && updatedLead.client.email) {
            const clientOfferLink = `${FRONTEND_URL}/client/lead-offer/${updatedLead.id}`;
            await emailService.sendProjectOfferToClient(
                updatedLead.client.email,
                updatedLead.client.name,
                updatedLead.porjectTitle,
                updatedLead.offerPrice.toFixed(2),
                clientOfferLink,
                updatedLead.notes
            );
        }

        res.status(200).json({ success: true, message: 'Offer set and sent to client successfully.', data: updatedLead });
    } catch (error) {
        console.error('Error setting offer price and sending:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.clientAcceptOffer = async (req, res) => {
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
            return res.status(400).json({ success: false, message: `Offer cannot be accepted. Current lead status is "${lead.status}".` });
        }

        if (!lead.offerPrice || !lead.partnerCost || !lead.adminMargin || !lead.assignedPartnerId || !lead.processedById) {
            return res.status(400).json({ success: false, message: 'Offer details or assigned partner/admin missing for this lead. Please contact support.' });
        }

        const result = await prisma.$transaction(async (prisma) => {
            const newProject = await prisma.project.create({
                data: {
                    title: lead.porjectTitle,
                    description: lead.description,
                    projectCategory: lead.projectCategory,
                    budget: lead.budgetRange,
                    timeline: lead.timeline,
                    offerPrice: lead.offerPrice,
                    partnerCost: lead.partnerCost,
                    adminMargin: lead.adminMargin,
                    includesGST: lead.includesGST,
                    clientId: lead.clientId,
                    partnerId: lead.assignedPartnerId,
                    leadId: lead.id,
                    createdByAdminId: lead.processedById,
                    status: 'IN_PROGRESS',
                    acceptedAt: new Date(),
                }
            });

            const updatedLead = await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    status: 'ACCEPTED_AND_CONVERTED',
                    projectId: newProject.id,
                }
            });

            if (lead.client && lead.client.email) {
                await emailService.sendProjectAcceptedConfirmation(
                    lead.client.email,
                    lead.client.name,
                    newProject.title
                );
            }
            if (lead.assignedPartner && lead.assignedPartner.email) {
                await emailService.sendPartnerSetPasswordEmail(
                    lead.assignedPartner.email,
                    `${FRONTEND_URL}/partner/projects/${newProject.id}`,
                    lead.assignedPartner.name
                );
            }
            if (lead.processedBy && lead.processedBy.email) {
                await emailService.sendVerificationEmail(
                    lead.processedBy.email,
                    `${FRONTEND_URL}/admin/projects/${newProject.id}`,
                    lead.processedBy.name
                );
            }

            return { newProject, updatedLead };
        });

        res.status(200).json({
            success: true,
            message: 'Offer accepted and project created successfully!',
            project: result.newProject
        });

    } catch (error) {
        console.error('Error accepting offer and converting to project:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.clientRejectOffer = async (req, res) => {
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
            include: { client: true, assignedPartner: true, processedBy: true }
        });

        if (updatedLead.client && updatedLead.client.email) {
            await emailService.sendProjectRejectedNotification(
                updatedLead.client.email,
                updatedLead.client.name,
                updatedLead.porjectTitle
            );
        }

        if (updatedLead.processedBy && updatedLead.processedBy.email) {
            await emailService.sendVerificationEmail(
                updatedLead.processedBy.email,
                `${FRONTEND_URL}/admin/leads/${updatedLead.id}`,
                updatedLead.processedBy.name
            );
        }
        if (updatedLead.assignedPartner && updatedLead.assignedPartner.email) {
            await emailService.sendPartnerSetPasswordEmail(
                updatedLead.assignedPartner.email,
                `${FRONTEND_URL}/partner/leads/${updatedLead.id}`,
                updatedLead.assignedPartner.name
            );
        }

        res.status(200).json({ success: true, message: 'Offer rejected successfully.', data: updatedLead });

    } catch (error) {
        console.error('Error rejecting offer:', error);
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
    const { name, email, phone, companyName, projectCategory, porjectTitle, description, keyFeatures, budgetRange, timeline, status, assignedPartnerId } = req.body;

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
        if (porjectTitle) updateData.porjectTitle = porjectTitle;
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