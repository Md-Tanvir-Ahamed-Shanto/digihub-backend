// src/controllers/summaryController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

/**
 * @route POST /api/summaries
 * @desc Create a new financial summary (typically calculated, but can be manual)
 * @access Private (Admin only)
 */
exports.createSummary = async (req, res) => {
    const { month, totalRevenue, gstCollected, totalExpense, netProfit } = req.body;

    if (!month || totalRevenue === undefined || gstCollected === undefined || totalExpense === undefined || netProfit === undefined) {
        return res.status(400).json({ message: 'All summary fields are required.' });
    }

    try {
        const newSummary = await prisma.summary.create({
            data: {
                month,
                totalRevenue: parseFloat(totalRevenue),
                gstCollected: parseFloat(gstCollected),
                totalExpense: parseFloat(totalExpense),
                netProfit: parseFloat(netProfit),
            },
        });
        res.status(201).json({ message: 'Summary created successfully.', summary: newSummary });
    } catch (error) {
        console.error('Error creating summary:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route GET /api/summaries
 * @desc Get all financial summaries
 * @access Private (Admin only)
 */
exports.getAllSummaries = async (req, res) => {
    try {
        const summaries = await prisma.summary.findMany({
            orderBy: { createdAt: 'desc' }, // Order by most recent summary
        });
        res.status(200).json(summaries);
    } catch (error) {
        console.error('Error fetching all summaries:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route GET /api/summaries/:id
 * @desc Get financial summary by ID
 * @access Private (Admin only)
 */
exports.getSummaryById = async (req, res) => {
    const { id } = req.params;
    try {
        const summary = await prisma.summary.findUnique({
            where: { id: parseInt(id) },
        });
        if (!summary) {
            return res.status(404).json({ message: 'Summary not found.' });
        }
        res.status(200).json(summary);
    } catch (error) {
        console.error('Error fetching summary by ID:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route PUT /api/summaries/:id
 * @desc Update a financial summary
 * @access Private (Admin only)
 */
exports.updateSummary = async (req, res) => {
    const { id } = req.params;
    const { month, totalRevenue, gstCollected, totalExpense, netProfit } = req.body;

    try {
        const updatedSummary = await prisma.summary.update({
            where: { id: parseInt(id) },
            data: {
                month: month !== undefined ? month : undefined,
                totalRevenue: totalRevenue !== undefined ? parseFloat(totalRevenue) : undefined,
                gstCollected: gstCollected !== undefined ? parseFloat(gstCollected) : undefined,
                totalExpense: totalExpense !== undefined ? parseFloat(totalExpense) : undefined,
                netProfit: netProfit !== undefined ? parseFloat(netProfit) : undefined,
            },
        });
        res.status(200).json({ message: 'Summary updated successfully.', summary: updatedSummary });
    } catch (error) {
        console.error('Error updating summary:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Summary not found.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route DELETE /api/summaries/:id
 * @desc Delete a financial summary
 * @access Private (Admin only)
 */
exports.deleteSummary = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.summary.delete({ where: { id: parseInt(id) } });
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Error deleting summary:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Summary not found.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};