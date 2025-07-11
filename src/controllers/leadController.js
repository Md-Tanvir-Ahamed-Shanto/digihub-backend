// src/controllers/leadController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const config = require('../config'); // For FRONTEND_URL

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

exports.submitLead = async (req, res) => {
    const { name, email, phone, companyName, projectCategory, porjectTitle, description, keyFeatures, budgetRange, timeline } = req.body;

    // Validate required fields for lead and client creation
    if (!name || !email || !phone || !projectCategory || !porjectTitle || !description || !budgetRange) {
        return res.status(400).json({ message: "Name, email, phone, project category, project title, description, and budget range are required." });
    }

    try {
        let client;
        // 1. Check if a Client account already exists for this email
        const existingClient = await prisma.client.findUnique({ where: { email } });

        if (existingClient) {
            // If client exists and is already verified, link lead to existing client
            if (existingClient.isEmailVerified && existingClient.isActive) {
                client = existingClient;
                console.log(`Lead from existing active client ${email}`);
                // You might send a notification that a new quote was submitted from their account
            } else {
                // Client exists but is not verified/active.
                // Re-send the set password/verification link.
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

                client = await prisma.client.update({
                    where: { id: existingClient.id },
                    data: {
                        verificationToken,
                        verificationExpires,
                        // Do not change isActive/isEmailVerified here, they remain false
                        // The user will activate via the set password link
                    },
                });
                const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
                await emailService.sendSetPasswordEmail(email, setPasswordLink, name);
                return res.status(200).json({
                    message: "An unverified account with this email exists. We've resent the account setup link. Please check your email to set your password and activate your account.",
                });
            }
        } else {
            // 2. Client account does NOT exist, create a new one (without password initially)
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            client = await prisma.client.create({
                data: {
                    name,
                    email,
                    phone, // Phone is now required for client creation from lead
                    companyName,
                    isActive: false, // Inactive until password is set
                    isEmailVerified: false, // Not verified until password is set
                    verificationToken,
                    verificationExpires,
                    password: null, // Password is NOT set at this stage
                },
            });
            console.log(`New client account created for ${email} from lead.`);

            // Send email to set password
            const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
            await emailService.sendSetPasswordEmail(email, setPasswordLink, name);
        }

        // 3. Create the Lead record and link it to the Client
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
                clientId: client.id, // Link the lead to the newly created/found client
                status: 'PENDING', // Default status for new leads
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
        // Handle unique constraint violation for email if not caught by findUnique
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: "An account with this email already exists. If you already have an account, please login. Otherwise, check your email for the account setup link." });
        }
        res.status(500).json({ message: "Internal server error." });
    }
};

// Admin-specific actions for leads (e.g., getting all leads, updating lead status)
// (You'll add these as needed, similar to your clientController admin functions)
exports.getAllLeadsForAdmin = async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                    }
                },
                assignedPartner: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                processedBy: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });
        res.status(200).json(leads);
    } catch (error) {
        console.error("Admin: Get all leads error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getLeadByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
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
                    }
                },
                assignedPartner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                },
                processedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                },
                project: true, // If it has been converted to a project
            },
        });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }
        res.status(200).json(lead);
    } catch (error) {
        console.error("Admin: Get lead by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateLeadByAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, companyName, projectCategory, porjectTitle, description, keyFeatures, budgetRange, timeline, status, clientId, partnerId, adminId } = req.body;

    try {
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
        if (status) updateData.status = status; // Ensure status is a valid LeadStatus enum value
        if (clientId) updateData.clientId = clientId;
        if (partnerId) updateData.partnerId = partnerId;
        if (adminId) updateData.adminId = adminId;

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: updateData,
            include: {
                client: {
                    select: { id: true, name: true, email: true }
                },
                assignedPartner: {
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
        await prisma.lead.delete({ where: { id } });
        res.status(204).send(); // No content for successful deletion
    } catch (error) {
        console.error("Admin: Delete lead error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Lead not found" });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ message: "Cannot delete lead due to existing related data (e.g., converted project). Consider soft delete if this is common." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};