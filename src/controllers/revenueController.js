// src/controllers/revenueController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

/**
 * @route POST /api/revenues
 * @desc Create a new revenue entry
 * @access Private (Admin only)
 */
exports.createRevenue = async (req, res) => {
    const { month, amount } = req.body;

    if (!month || !amount) {
        return res.status(400).json({ message: 'Month and amount are required.' });
    }

    try {
        const newRevenue = await prisma.revenue.create({
            data: {
                month,
                amount: parseFloat(amount),
            },
        });
        res.status(201).json({ message: 'Revenue entry created successfully.', revenue: newRevenue });
    } catch (error) {
        console.error('Error creating revenue entry:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route GET /api/revenues
 * @desc Get all revenue entries
 * @access Private (Admin only)
 */
exports.getAllRevenues = async (req, res) => {
    try {
        const revenues = await prisma.revenue.findMany({
            orderBy: { createdAt: 'desc' }, // Order by most recent entry
        });
        res.status(200).json(revenues);
    } catch (error) {
        console.error('Error fetching all revenues:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route GET /api/revenues/:id
 * @desc Get revenue entry by ID
 * @access Private (Admin only)
 */
exports.getRevenueById = async (req, res) => {
    const { id } = req.params;
    try {
        const revenue = await prisma.revenue.findUnique({
            where: { id: parseInt(id) },
        });
        if (!revenue) {
            return res.status(404).json({ message: 'Revenue entry not found.' });
        }
        res.status(200).json(revenue);
    } catch (error) {
        console.error('Error fetching revenue entry by ID:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route PUT /api/revenues/:id
 * @desc Update a revenue entry
 * @access Private (Admin only)
 */
exports.updateRevenue = async (req, res) => {
    const { id } = req.params;
    const { month, amount } = req.body;

    try {
        const updatedRevenue = await prisma.revenue.update({
            where: { id: parseInt(id) },
            data: {
                month: month !== undefined ? month : undefined,
                amount: amount !== undefined ? parseFloat(amount) : undefined,
            },
        });
        res.status(200).json({ message: 'Revenue entry updated successfully.', revenue: updatedRevenue });
    } catch (error) {
        console.error('Error updating revenue entry:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Revenue entry not found.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route DELETE /api/revenues/:id
 * @desc Delete a revenue entry
 * @access Private (Admin only)
 */
exports.deleteRevenue = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.revenue.delete({ where: { id: parseInt(id) } });
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Error deleting revenue entry:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Revenue entry not found.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};