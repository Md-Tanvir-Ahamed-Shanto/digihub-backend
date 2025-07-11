// src/controllers/invoiceController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

// Helper to generate a simple invoice number
const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
    return `INV-${year}${month}${day}-${randomSuffix}`;
};


// --- Admin-specific Invoice Management Routes ---
// Note: Invoices are often generated automatically (e.g., when a milestone is APPROVED)
// This `createInvoiceByAdmin` is for manual creation/adjustments by admin.

exports.createInvoiceByAdmin = async (req, res) => {
    const { clientId, projectId, milestoneId, amount, gstEnabled, dueDate } = req.body;

    if (!clientId || !projectId || amount === undefined || !dueDate) {
        return res.status(400).json({ message: "Client ID, Project ID, Amount, and Due Date are required." });
    }

    try {
        const baseAmount = new Decimal(amount);
        const gstEnabledBool = !!gstEnabled;
        const gstAmount = gstEnabledBool ? baseAmount.mul(new Decimal('0.10')) : new Decimal(0);
        const totalAmount = baseAmount.add(gstAmount);

        const newInvoice = await prisma.invoice.create({
            data: {
                invoiceNumber: generateInvoiceNumber(),
                clientId,
                projectId,
                milestoneId: milestoneId || undefined,
                amount: baseAmount,
                gstAmount,
                totalAmount,
                gstEnabled: gstEnabledBool,
                status: 'SENT', // Admin usually creates invoices to be sent
                dueDate: new Date(dueDate),
            },
        });
        res.status(201).json({ message: "Invoice created successfully by Admin", invoice: newInvoice });
    } catch (error) {
        console.error("Admin: Create invoice error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllInvoicesForAdmin = async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                payments: { select: { id: true, amount: true, status: true, method: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(invoices);
    } catch (error) {
        console.error("Admin: Get all invoices error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getInvoiceByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                payments: { select: { id: true, amount: true, status: true, method: true, createdAt: true } }
            },
        });
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        res.status(200).json(invoice);
    } catch (error) {
        console.error("Admin: Get invoice by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateInvoiceByAdmin = async (req, res) => {
    const { id } = req.params;
    const { invoiceNumber, amount, gstEnabled, status, dueDate, paidAt } = req.body;

    try {
        const currentInvoice = await prisma.invoice.findUnique({ where: { id } });
        if (!currentInvoice) {
            return res.status(404).json({ message: "Invoice not found." });
        }

        const updateData = {};
        if (invoiceNumber) updateData.invoiceNumber = invoiceNumber;

        if (amount !== undefined || gstEnabled !== undefined) {
            const baseAmount = amount !== undefined ? new Decimal(amount) : currentInvoice.amount;
            const currentGstEnabled = gstEnabled !== undefined ? !!gstEnabled : currentInvoice.gstEnabled;
            const gstAmount = currentGstEnabled ? baseAmount.mul(new Decimal('0.10')) : new Decimal(0);
            const totalAmount = baseAmount.add(gstAmount);

            updateData.amount = baseAmount;
            updateData.gstEnabled = currentGstEnabled;
            updateData.gstAmount = gstAmount;
            updateData.totalAmount = totalAmount;
        }

        if (status) updateData.status = status;
        if (dueDate) updateData.dueDate = new Date(dueDate);
        if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null;

        const updatedInvoice = await prisma.invoice.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Invoice updated successfully by Admin", invoice: updatedInvoice });
    } catch (error) {
        console.error("Admin: Update invoice error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Invoice not found" });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('invoiceNumber')) {
            return res.status(409).json({ message: "Invoice number already exists." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteInvoiceByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        // Deleting an invoice might require deleting associated payments or setting their invoiceId to null.
        // If your schema has `onDelete: Cascade` for payments, they will be deleted.
        // If it's `onDelete: SetNull`, their invoiceId will be nullified.
        // Otherwise, you'll get a foreign key constraint error.
        await prisma.invoice.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete invoice error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Invoice not found" });
        }
        if (error.code === 'P2003') { // Foreign key constraint error
            return res.status(409).json({ message: "Cannot delete invoice due to existing payments linked to it. Delete payments first." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Client-specific Invoice Routes ---

exports.getClientInvoices = async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            where: { clientId: req.user.id },
            include: {
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                payments: { select: { id: true, amount: true, status: true, method: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(invoices);
    } catch (error) {
        console.error("Client: Get invoices error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientInvoiceById = async (req, res) => {
    const { id } = req.params;
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id, clientId: req.user.id }, // Ensure invoice belongs to the client
            include: {
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                payments: { select: { id: true, amount: true, status: true, method: true, createdAt: true } }
            },
        });
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found or you don't have access to it." });
        }
        res.status(200).json(invoice);
    } catch (error) {
        console.error("Client: Get invoice by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};