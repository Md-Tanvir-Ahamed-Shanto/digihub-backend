// src/controllers/clientController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService'); // Re-using for set password email
const config = require('../config');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Client Login with Email Verification Check
exports.clientLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const client = await prisma.client.findUnique({ where: { email } });
        if (!client || !client.password) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const isPasswordValid = await bcrypt.compare(password, client.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (!client.isEmailVerified) {
            return res.status(403).json({ message: "Please verify your email address to log in. Check your inbox for a verification link." });
        }

        if (!client.isActive) {
            return res.status(403).json({ message: "Your account is currently inactive. Please contact support." });
        }

        const token = jwt.sign(
            { id: client.id, email: client.email, role: 'client' },
            config.jwtSecret,
            { expiresIn: '8h' }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            client: {
                id: client.id,
                email: client.email,
                name: client.name,
                companyName: client.companyName,
                isActive: client.isActive,
                isEmailVerified: client.isEmailVerified,
                role: 'client'
            }
        });
    } catch (error) {
        console.error("Client login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Client Registration (direct signup, now also sends set-password link)
exports.registerClient = async (req, res) => {
    const { email, name, companyName, phone } = req.body; // Password is not required at initial registration
    if (!email || !name) {
        return res.status(400).json({ message: "Email and name are required." });
    }
    // Note: Password is set via the verification link, so it's not taken here

    try {
        const existingClient = await prisma.client.findUnique({ where: { email } });
        if (existingClient) {
            if (existingClient.isEmailVerified && existingClient.isActive) {
                return res.status(409).json({ message: "An account with this email already exists and is active. Please try logging in." });
            } else {
                // If an account exists but is not verified/active, allow re-registration
                // For simplicity, we'll re-send the link and update the token
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

                await prisma.client.update({
                    where: { id: existingClient.id },
                    data: {
                        verificationToken,
                        verificationExpires,
                        // Do not change isActive/isEmailVerified here, they remain false
                        password: null, // Ensure password is null if it was never set or was cleared
                    },
                });
                const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
                await emailService.sendSetPasswordEmail(email, setPasswordLink, name);
                return res.status(200).json({
                    message: "An unverified account with this email already exists. We've resent the account setup link. Please check your email to set your password and activate your account.",
                });
            }
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Token valid for 24 hours

        const newClient = await prisma.client.create({
            data: {
                email,
                name,
                phone, // Phone from direct signup
                companyName,
                isActive: false, // Inactive until password is set and verified
                isEmailVerified: false, // Not verified initially
                password: null, // Password is NOT set at this stage
                verificationToken, // Store the generated token
                verificationExpires, // Store the token expiry
            },
        });

        const setPasswordLink = `${FRONTEND_URL}/set-password?token=${verificationToken}`;
        await emailService.sendSetPasswordEmail(email, setPasswordLink, name);

        const { password: _, verificationToken: __, verificationExpires: ___, ...clientWithoutSensitiveInfo } = newClient;
        res.status(201).json({
            message: "Registration successful! Please check your email to set your password and activate your account.",
            client: clientWithoutSensitiveInfo
        });

    } catch (error) {
        console.error("Client registration error:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

// NEW: Function to handle setting password and activating account after email verification
exports.setClientPasswordAndActivate = async (req, res) => {
    const { token } = req.query; // Token from the URL
    const { password } = req.body; // Password submitted by the user

    if (!token || !password) {
        return res.status(400).json({ message: "Verification token and new password are required." });
    }

    try {
        const client = await prisma.client.findFirst({
            where: {
                verificationToken: token,
                verificationExpires: {
                    gt: new Date(), // Token must not be expired
                },
                // Password must be null, indicating it's the first time setting it
                // Or you can allow resetting it if it was previously set, depending on flow
            },
        });

        if (!client) {
            // Redirect to an error page or send an appropriate response
            const redirectUrl = `${FRONTEND_URL}/set-password-failed?reason=invalid_or_expired`;
            // return res.redirect(redirectUrl); // Use redirect for GET requests, JSON for POST
            return res.status(404).json({ message: "Invalid, expired, or already used token." });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update client with new password, activate account, and clear token fields
        await prisma.client.update({
            where: { id: client.id },
            data: {
                password: hashedPassword,
                isEmailVerified: true,
                isActive: true, // Account is now fully active
                verificationToken: null, // Clear the token after use
                verificationExpires: null, // Clear the expiry
            },
        });

        // You might want to redirect them to a success page or the login page
        const redirectUrl = `${FRONTEND_URL}/account-activated?email=${encodeURIComponent(client.email)}`;
        // res.redirect(redirectUrl);

        // Or if this is an API endpoint (POST/PUT), send JSON response:
        res.status(200).json({ message: "Account activated and password set successfully. You can now log in." });

    } catch (error) {
        console.error("Client set password and activate error:", error);
        const redirectUrl = `${FRONTEND_URL}/set-password-failed?reason=server_error`;
        res.redirect(redirectUrl);
        // res.status(500).json({ message: "Internal server error." });
    }
};


exports.getClientProfile = async (req, res) => {
    try {
        const client = await prisma.client.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                companyName: true,
                phone: true, // Include phone number
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        projects: true,
                        invoices: true,
                        supportTickets: true,
                    }
                }
            },
        });
        if (!client) {
            return res.status(404).json({ message: "Client profile not found" });
        }
        res.status(200).json(client);
    } catch (error) {
        console.error("Get client profile error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateClientProfile = async (req, res) => {
    const { name, companyName, phone, oldPassword, newPassword } = req.body;
    try {
        const client = await prisma.client.findUnique({ where: { id: req.user.id } });
        if (!client) {
            return res.status(404).json({ message: "Client not found" });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (companyName !== undefined) updateData.companyName = companyName;
        if (phone !== undefined) updateData.phone = phone; // Allow phone update

        if (oldPassword && newPassword) {
            if (!client.password) {
                return res.status(400).json({ message: "No current password set. Please use the 'Set Password' link or contact admin to set one first." });
            }
            const isPasswordValid = await bcrypt.compare(oldPassword, client.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: "Old password does not match" });
            }
            updateData.password = await bcrypt.hash(newPassword, 10);
        } else if (newPassword) {
            return res.status(400).json({ message: "Old password is required to change password" });
        }

        const updatedClient = await prisma.client.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                companyName: true,
                phone: true, // Include phone number
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(200).json({ message: "Profile updated successfully", client: updatedClient });
    } catch (error) {
        console.error("Update client profile error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// --- Admin-specific actions on clients (requires isAdmin role) ---

exports.getAllClientsForAdmin = async (req, res) => {
    try {
        const clients = await prisma.client.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                companyName: true,
                phone: true, // Include phone number
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        leads: true,
                        projects: true,
                        payments: true,
                        invoices: true,
                        supportTickets: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(clients);
    } catch (error) {
        console.error("Admin: Get all clients error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await prisma.client.findUnique({
            where: { id },
            include: {
                leads: true,
                projects: true,
                payments: true,
                supportTickets: true,
                invoices: true,
            },
        });
        if (!client) {
            return res.status(404).json({ message: "Client not found" });
        }
        res.status(200).json(client);
    } catch (error) {
        console.error("Admin: Get client by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateClientByAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, email, companyName, phone, isActive, password, isEmailVerified } = req.body;
    try {
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (companyName !== undefined) updateData.companyName = companyName;
        if (phone !== undefined) updateData.phone = phone; // Allow admin to update phone
        if (isActive !== undefined) updateData.isActive = !!isActive;
        if (isEmailVerified !== undefined) updateData.isEmailVerified = !!isEmailVerified;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        const updatedClient = await prisma.client.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                companyName: true,
                phone: true, // Include phone
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(200).json({ message: "Client updated successfully by Admin", client: updatedClient });
    } catch (error) {
        console.error("Admin: Update client error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Client not found" });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteClientByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.client.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete client error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Client not found" });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ message: "Cannot delete client due to existing related data (e.g., projects, invoices). Please delete related records first or consider soft delete." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};