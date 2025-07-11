// src/controllers/contactSubmissionController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- Public/Guest Contact Submission Route ---

exports.submitContactForm = async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: "Name, email, and message are required fields." });
    }

    // Basic email format validation (can be more robust)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid email format." });
    }

    try {
        const newSubmission = await prisma.contactSubmission.create({
            data: {
                name,
                email,
                subject: subject || null, // Subject is optional
                message,
                isReplied: false, // Default to false
            },
        });
        res.status(201).json({ message: "Your contact message has been submitted successfully!", submission: newSubmission });
    } catch (error) {
        console.error("Contact form submission error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// --- Admin-Specific Contact Submission Management Routes ---

exports.getAllContactSubmissionsForAdmin = async (req, res) => {
    try {
        const submissions = await prisma.contactSubmission.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(submissions);
    } catch (error) {
        console.error("Admin: Get all contact submissions error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getContactSubmissionByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const submission = await prisma.contactSubmission.findUnique({
            where: { id },
        });
        if (!submission) {
            return res.status(404).json({ message: "Contact submission not found." });
        }
        res.status(200).json(submission);
    } catch (error) {
        console.error("Admin: Get contact submission by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateContactSubmissionByAdmin = async (req, res) => {
    const { id } = req.params;
    const { isReplied } = req.body; // Typically, only isReplied status is updated by admin

    if (isReplied === undefined || typeof isReplied !== 'boolean') {
        return res.status(400).json({ message: "A boolean value for 'isReplied' is required." });
    }

    try {
        const updatedSubmission = await prisma.contactSubmission.update({
            where: { id },
            data: { isReplied },
        });
        res.status(200).json({ message: "Contact submission updated successfully", submission: updatedSubmission });
    } catch (error) {
        console.error("Admin: Update contact submission error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Contact submission not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteContactSubmissionByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.contactSubmission.delete({ where: { id } });
        res.status(204).send(); // No content
    } catch (error) {
        console.error("Admin: Delete contact submission error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Contact submission not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};