// src/controllers/gstReportController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

/**
 * @route POST /api/gst-reports
 * @desc Create a new GST report
 * @access Private (Admin only)
 */
exports.createGstReport = async (req, res) => {
    const { period, gstCollected, gstPaid, status, dueDate } = req.body;

    if (!period || gstCollected === undefined || gstPaid === undefined || !status || !dueDate) {
        return res.status(400).json({ message: 'Period, GST collected, GST paid, status, and due date are required.' });
    }

    try {
        const newGstReport = await prisma.gstReport.create({
            data: {
                period,
                gstCollected: parseFloat(gstCollected),
                gstPaid: parseFloat(gstPaid),
                status,
                dueDate: new Date(dueDate),
            },
        });
        res.status(201).json({ message: 'GST report created successfully.', gstReport: newGstReport });
    } catch (error) {
        console.error('Error creating GST report:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route GET /api/gst-reports
 * @desc Get all GST reports
 * @access Private (Admin only)
 */
exports.getAllGstReports = async (req, res) => {
    try {
        const gstReports = await prisma.gstReport.findMany({
            orderBy: { dueDate: 'desc' }, // Order by most recent due date
        });
        res.status(200).json(gstReports);
    } catch (error) {
        console.error('Error fetching all GST reports:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route GET /api/gst-reports/:id
 * @desc Get GST report by ID
 * @access Private (Admin only)
 */
exports.getGstReportById = async (req, res) => {
    const { id } = req.params;
    try {
        const gstReport = await prisma.gstReport.findUnique({
            where: { id: parseInt(id) },
        });
        if (!gstReport) {
            return res.status(404).json({ message: 'GST report not found.' });
        }
        res.status(200).json(gstReport);
    } catch (error) {
        console.error('Error fetching GST report by ID:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route PUT /api/gst-reports/:id
 * @desc Update a GST report
 * @access Private (Admin only)
 */
exports.updateGstReport = async (req, res) => {
    const { id } = req.params;
    const { period, gstCollected, gstPaid, status, dueDate } = req.body;

    try {
        const updatedGstReport = await prisma.gstReport.update({
            where: { id: parseInt(id) },
            data: {
                period: period !== undefined ? period : undefined,
                gstCollected: gstCollected !== undefined ? parseFloat(gstCollected) : undefined,
                gstPaid: gstPaid !== undefined ? parseFloat(gstPaid) : undefined,
                status: status !== undefined ? status : undefined,
                dueDate: dueDate !== undefined ? new Date(dueDate) : undefined,
            },
        });
        res.status(200).json({ message: 'GST report updated successfully.', gstReport: updatedGstReport });
    } catch (error) {
        console.error('Error updating GST report:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'GST report not found.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @route DELETE /api/gst-reports/:id
 * @desc Delete a GST report
 * @access Private (Admin only)
 */
exports.deleteGstReport = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.gstReport.delete({ where: { id: parseInt(id) } });
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Error deleting GST report:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'GST report not found.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
};