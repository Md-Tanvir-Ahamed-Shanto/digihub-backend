const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Decimal = require('decimal.js');
const crypto = require('crypto'); 
const emailService = require('../utils/emailService'); 

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080'; 

// --- Public Partner Routes (Login / Password Setup) ---

exports.partnerLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const partner = await prisma.partner.findUnique({ where: { email } });
        if (!partner || !partner.password) { // Check if password is null (not set yet)
            return res.status(400).json({ message: "Invalid credentials or account not fully set up." });
        }
        const isPasswordValid = await bcrypt.compare(password, partner.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (!partner.isActive) { // Check if account is active
            return res.status(403).json({ message: "Your account is inactive. Please check your email for the activation link or contact support." });
        }

        const token = jwt.sign(
            { id: partner.id,name: partner.name, email: partner.email, role: 'partner' },
            config.jwtSecret,
            { expiresIn: '8h' }
        );

        const { password: _, verificationToken: __, verificationExpires: ___, ...partnerWithoutSensitiveInfo } = partner;
        res.status(200).json({
            message: "Login successful",
            token,
            partner: { ...partnerWithoutSensitiveInfo, role: 'partner' }
        });
    } catch (error) {
        console.error("Partner login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// This route remains forbidden as partner self-registration is not allowed.
exports.registerPartner = async (req, res) => {
    return res.status(403).json({ message: "Partner self-registration is not allowed. Please contact an administrator to create an account." });
};

// NEW: Function to handle setting password and activating partner account
exports.setPartnerPasswordAndActivate = async (req, res) => {
    const { token } = req.query; 
    const { password } = req.body; 

    if (!token || !password) {
        return res.status(400).json({ message: "Activation token and new password are required." });
    }

    try {
        const partner = await prisma.partner.findFirst({
            where: {
                verificationToken: token,
                verificationExpires: {
                    gt: new Date(), 
                },
            },
        });

        if (!partner) {
            // Redirect to an error page or send an appropriate response
            const redirectUrl = `${FRONTEND_URL}/set-password-failed?reason=invalid_or_expired`;
            return res.redirect(redirectUrl);
            // return res.status(404).json({ message: "Invalid, expired, or already used token." });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update partner with new password, activate account, and clear token fields
        await prisma.partner.update({
            where: { id: partner.id },
            data: {
                password: hashedPassword,
                isActive: true, 
                verificationToken: null, 
                verificationExpires: null, 
            },
        });

        // You might want to redirect them to a success page or the partner login page
        const redirectUrl = `${FRONTEND_URL}/partner/account-activated?email=${encodeURIComponent(partner.email)}`;
        res.redirect(redirectUrl);

        // Or if this is an API endpoint (POST/PUT), send JSON response:
        // res.status(200).json({ message: "Partner account activated and password set successfully. You can now log in." });

    } catch (error) {
        console.error("Partner set password and activate error:", error);
        const redirectUrl = `${FRONTEND_URL}/set-password-failed?reason=server_error`;
        res.redirect(redirectUrl);
        // res.status(500).json({ message: "Internal server error." });
    }
};

// --- Authenticated Partner Routes (for the logged-in partner) ---

exports.getPartnerProfile = async (req, res) => {
    try {
        const partner = await prisma.partner.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, email: true, name: true, skillSet: true, industryExp: true,
                country: true, region: true, profilePhoto: true, hourlyRate: true,
                portfolioLink: true, isActive: true, rating: true, totalEarnings: true,
                availableBalance: true, createdAt: true, updatedAt: true,
                _count: {
                    select: {
                        assignedProjects: true,
                        milestones: true,
                        withdrawals: true,
                       
                    }
                }
            },
        });
        if (!partner) {
            return res.status(404).json({ message: "Partner profile not found" });
        }
        res.status(200).json(partner);
    } catch (error) {
        console.error("Get partner profile error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updatePartnerProfile = async (req, res) => {
    const { name, skillSet, industryExp, country, region, profilePhoto, hourlyRate, portfolioLink, oldPassword, newPassword } = req.body;
    try {
        const partner = await prisma.partner.findUnique({ where: { id: req.user.id } });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (skillSet) updateData.skillSet = skillSet;
        if (industryExp) updateData.industryExp = industryExp;
        if (country !== undefined) updateData.country = country;
        if (region !== undefined) updateData.region = region;
        if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;
        if (hourlyRate !== undefined) updateData.hourlyRate = new Decimal(hourlyRate);
        if (portfolioLink !== undefined) updateData.portfolioLink = portfolioLink;

        if (oldPassword && newPassword) {
            if (!partner.password) {
                return res.status(400).json({ message: "No current password set. Please use the 'Set Password' link or contact admin." });
            }
            const isPasswordValid = await bcrypt.compare(oldPassword, partner.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: "Old password does not match" });
            }
            updateData.password = await bcrypt.hash(newPassword, 10);
        } else if (newPassword) {
            return res.status(400).json({ message: "Old password is required to change password" });
        }

        const updatedPartner = await prisma.partner.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true, email: true, name: true, skillSet: true, industryExp: true,
                country: true, region: true, profilePhoto: true, hourlyRate: true,
                portfolioLink: true, isActive: true, rating: true, totalEarnings: true,
                availableBalance: true, createdAt: true, updatedAt: true,
            },
        });
        res.status(200).json({ message: "Profile updated successfully", partner: updatedPartner });
    } catch (error) {
        console.error("Update partner profile error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Partners can request withdrawals. The actual processing will be by admin.
exports.requestWithdrawal = async (req, res) => {
    const { amount, note } = req.body;
    if (!amount || new Decimal(amount).lessThanOrEqualTo(0)) {
        return res.status(400).json({ message: "A valid amount is required for withdrawal." });
    }

    try {
        const partner = await prisma.partner.findUnique({
            where: { id: req.user.id },
            select: { availableBalance: true }
        });

        if (!partner) {
            return res.status(404).json({ message: "Partner not found." });
        }

        if (new Decimal(amount).greaterThan(partner.availableBalance)) {
            return res.status(400).json({ message: "Requested amount exceeds available balance." });
        }

        const newWithdrawal = await prisma.withdrawal.create({
            data: {
                amount: new Decimal(amount),
                status: 'PENDING',
                partnerId: req.user.id,
                note: note || null,
            }
        });
        await prisma.partner.update({
            where: { id: req.user.id },
            data: {
                availableBalance: {
                    decrement: new Decimal(amount)
                }
            }
        });

        res.status(201).json({ message: "Withdrawal request submitted successfully", withdrawal: newWithdrawal });
    } catch (error) {
        console.error("Request withdrawal error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerWithdrawals = async (req, res) => {
    try {
        const withdrawals = await prisma.withdrawal.findMany({
            where: { partnerId: req.user.id },
            orderBy: { requestedAt: 'desc' }
        });
        res.status(200).json(withdrawals);
    } catch (error) {
        console.error("Get partner withdrawals error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Admin-specific Partner Management Routes (requires isAdmin role) ---

exports.createPartnerByAdmin = async (req, res) => {
    const { email, name, skillSet, industryExp, country, region, profilePhoto, hourlyRate, portfolioLink } = req.body;
    // Password is NOT provided here; it's set by the partner via email link

    if (!email || !name || !skillSet || !industryExp) {
        return res.status(400).json({ message: "Email, name, skill set, and industry experience are required." });
    }
    if (!req.user || !req.user.id) {
        return res.status(403).json({ message: "Admin ID is required to create a partner." });
    }

    try {
        const existingPartner = await prisma.partner.findUnique({ where: { email } });
        if (existingPartner) {
            // If partner exists and is already active, prevent re-creation
            if (existingPartner.isActive && existingPartner.password) {
                return res.status(409).json({ message: "A partner with this email already exists and is active." });
            } else {
                // Partner exists but is not active/password not set. Re-send activation link.
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

                await prisma.partner.update({
                    where: { id: existingPartner.id },
                    data: {
                        name, email, skillSet, industryExp, country, region, profilePhoto,
                        hourlyRate: hourlyRate !== undefined ? new Decimal(hourlyRate) : undefined,
                        portfolioLink,
                        verificationToken,
                        verificationExpires,
                        isActive: false, // Ensure it remains inactive until password is set
                        password: null, // Clear password if it was somehow set but account inactive
                    },
                });

                const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
                await emailService.sendPartnerSetPasswordEmail(email, setPasswordLink, name);
                return res.status(200).json({
                    message: "Partner account already exists but is inactive. An activation link has been re-sent to their email.",
                });
            }
        }

        // Generate token for email verification/password setup
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Token valid for 24 hours

        const newPartner = await prisma.partner.create({
            data: {
                email,
                name,
                skillSet,
                industryExp,
                country,
                region,
                profilePhoto,
                hourlyRate: hourlyRate !== undefined ? new Decimal(hourlyRate) : undefined,
                portfolioLink,
                isActive: false, // Inactive until password is set via email link
                rating: new Decimal(0), // Default values
                totalEarnings: new Decimal(0),
                availableBalance: new Decimal(0),
                createdById: req.user.id, // Admin who created this partner
                password: null, // Password is NOT set at this stage
                verificationToken, // Store the generated token
                verificationExpires, // Store the token expiry
            },
        });

        // Send email to partner to set their password
        const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
        await emailService.sendPartnerSetPasswordEmail(email, setPasswordLink, name);

        // Exclude sensitive info from response
        const { password: _, verificationToken: __, verificationExpires: ___, ...partnerWithoutSensitiveInfo } = newPartner;
        res.status(201).json({
            message: "Partner account created successfully! An activation email has been sent to their email to set their password.",
            partner: partnerWithoutSensitiveInfo
        });
    } catch (error) {
        console.error("Admin: Create partner error:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: "Email already exists." });
        }
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.getAllPartnersForAdmin = async (req, res) => {
    try {
        const partners = await prisma.partner.findMany({
            select: {
                id: true, email: true, name: true, skillSet: true, industryExp: true,
                country: true, region: true, profilePhoto: true, hourlyRate: true,
                portfolioLink: true, isActive: true, rating: true, totalEarnings: true,
                availableBalance: true, createdAt: true, updatedAt: true,
                withdrawals: true,
                createdBy: { select: { id: true, name: true } },
                _count: {
                    select: {
                        assignedProjects: true,
                        milestones: true,
                        withdrawals: true,
                 
                       
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(partners);
    } catch (error) {
        console.error("Admin: Get all partners error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const partner = await prisma.partner.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
                assignedProjects: { select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' } },
                milestones: { select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' } },
                withdrawals: { orderBy: { requestedAt: 'desc' } },
                supportTickets: { select: { id: true, subject: true, status: true }, orderBy: { createdAt: 'desc' } },
                 assignedLeads: { select: { id: true, projectCategory: true, status: true }, orderBy: { createdAt: 'desc' } },
            },
        });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }
        res.status(200).json(partner);
    } catch (error) {
        console.error("Admin: Get partner by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updatePartnerByAdmin = async (req, res) => {
    const { id } = req.params;
    const { email, password, name, skillSet, industryExp, country, region, profilePhoto, hourlyRate, portfolioLink, isActive, rating, totalEarnings, availableBalance } = req.body;

    try {
        const updateData = {};
        if (email) updateData.email = email;
        if (password) updateData.password = await bcrypt.hash(password, 10); // Admin can set/reset password
        if (name) updateData.name = name;
        if (skillSet) updateData.skillSet = skillSet;
        if (industryExp) updateData.industryExp = industryExp;
        if (country !== undefined) updateData.country = country;
        if (region !== undefined) updateData.region = region;
        if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;
        if (hourlyRate !== undefined) updateData.hourlyRate = new Decimal(hourlyRate);
        if (portfolioLink !== undefined) updateData.portfolioLink = portfolioLink;
        if (isActive !== undefined) {
             updateData.isActive = !!isActive;
             // If admin activates account, ensure verification token is cleared (if they manually activate)
             if (!!isActive === true) {
                 updateData.verificationToken = null;
                 updateData.verificationExpires = null;
             }
        }
        if (rating !== undefined) updateData.rating = new Decimal(rating);
        if (totalEarnings !== undefined) updateData.totalEarnings = new Decimal(totalEarnings);
        if (availableBalance !== undefined) updateData.availableBalance = new Decimal(availableBalance);

        const updatedPartner = await prisma.partner.update({
            where: { id },
            data: updateData,
            select: {
                id: true, email: true, name: true, skillSet: true, industryExp: true,
                country: true, region: true, profilePhoto: true, hourlyRate: true,
                portfolioLink: true, isActive: true, rating: true, totalEarnings: true,
                availableBalance: true, createdAt: true, updatedAt: true,
            },
        });
        res.status(200).json({ message: "Partner updated successfully by Admin", partner: updatedPartner });
    } catch (error) {
        console.error("Admin: Update partner error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Partner not found" });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deletePartnerByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.partner.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete partner error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Partner not found" });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ message: "Cannot delete partner due to existing assigned projects, leads, or other related data. Please reassign or delete them first." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

// --- Get Partner's Own Assigned Leads ---
exports.getPartnerAssignedLeads = async (req, res) => {
    try {
        const partnerId = req.user.id; // From authMiddleware

        const assignedLeads = await prisma.lead.findMany({
            where: {
                assignedPartnerId: partnerId,
                status: {
                    in: [
                        'ASSIGNED_TO_PARTNER',
                        'PARTNER_OFFER_PROPOSED',
                        'OFFER_SENT_TO_CLIENT'
                    ]
                }
            },
            select: {
                id: true,
                projectTitle: true, // Check for typo: 'projectTitle' is usually preferred
                projectCategory: true,
                description: true,
                status: true,
                budgetRange: true,
                timeline: true,
                partnerProposedCost: true,
                partnerNotes: true,
                partnerOfferProposedAt: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({ success: true, data: assignedLeads });
    } catch (error) {
        console.error("Error fetching partner's assigned leads:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
};

// --- Partner Sends Offer to Admin ---
exports.submitOfferToAdmin = async (req, res) => {
    const { leadId } = req.params;
    const { proposedCost,timeline, notes } = req.body;

    try {
        const partnerId = req.user.id;
        const partnerName = req.user.name || 'A Partner'; // Get partner name from req.user

        if (!partnerId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }
        if(!timeline){
              return res.status(400).json({ success: false, message: "timeline is required." });
        }

        if (typeof proposedCost === 'undefined' || proposedCost === null) {
            return res.status(400).json({ success: false, message: "Proposed cost is required." });
        }
        const numericProposedCost = new Decimal(proposedCost);
        if (numericProposedCost.lessThanOrEqualTo(0)) {
            return res.status(400).json({ success: false, message: "Proposed cost must be a positive number." });
        }

        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                assignedPartnerId: true,
                status: true,
                projectTitle: true
            }
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found." });
        }

        if (lead.assignedPartnerId !== partnerId) {
            return res.status(403).json({ success: false, message: "You are not assigned to this lead." });
        }

        if (['OFFER_SENT_TO_CLIENT', 'OFFER_REJECTED_BY_CLIENT', 'OFFER_ACCEPTED_BY_CLIENT', 'ACCEPTED_AND_CONVERTED'].includes(lead.status)) {
            return res.status(400).json({ success: false, message: `Cannot submit offer for lead with current status: ${lead.status}.` });
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                partnerProposedCost: numericProposedCost,
                partnerNotes: notes || null,
                timeline: timeline || null,
                partnerOfferProposedAt: new Date(),
                status: 'PARTNER_OFFER_PROPOSED',
            },
            select: {
                id: true,
                projectTitle: true,
                partnerProposedCost: true,
                partnerNotes: true,
                timeline: true,
                status: true
            }
        });

        // --- Notify Admins ---
        const admins = await prisma.admin.findMany({
            select: {
                email: true,
                name: true
            }
        });

        for (const admin of admins) {
            if (admin.email) {
                await emailService.sendEmail({ // Using a generic sendEmail for custom content
                    to: admin.email,
                    subject: `New Offer Proposal for Lead: "${updatedLead.projectTitle}" by ${partnerName}`,
                    html: `
                        <p>Dear ${admin.name},</p>
                        <p>A partner has submitted an offer proposal for a lead:</p>
                        <ul>
                            <li><strong>Lead ID:</strong> ${updatedLead.id}</li>
                            <li><strong>Project Title:</strong> ${updatedLead.projectTitle}</li>
                            <li><strong>Partner Name:</strong> ${partnerName}</li>
                            <li><strong>Proposed Cost:</strong> $${updatedLead.partnerProposedCost.toFixed(2)}</li>
                            <li><strong>Proposed Timeline:</strong> $${updatedLead.timeline}</li>
                            <li><strong>Partner Notes:</strong> ${updatedLead.partnerNotes || 'N/A'}</li>
                        </ul>
                        <p>Please review the offer and proceed with preparing the client's final offer.</p>
                        <p>You can view the lead details here: <a href="${FRONTEND_URL}/admin/leads/${updatedLead.id}">View Lead</a></p>
                        <p>Best regards,</p>
                        <p>The DIGIHUB AUST Team</p>
                    `
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Offer for Lead ${leadId} submitted to admin successfully.`,
            data: updatedLead
        });

    } catch (error) {
        console.error("Error submitting partner offer to admin:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
};

exports.updateCredentials = async (req, res) => { 
    try {
      const { email,currentPassword, password } = req.body;
      const partner = await prisma.partner.findUnique({ where: { id: req.user.id } });
      if (!partner) {
        return res.status(404).json({ message: "partner not found" });
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, partner.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid current password" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.partner.update({
        where: { id: req.user.id },
        data: { email, password: hashedPassword },
      });
      res.status(200).json({ message: "Credentials updated successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
};