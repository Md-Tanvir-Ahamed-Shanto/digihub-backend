// src/controllers/paymentController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

// --- Admin-specific Payment Management Routes ---

exports.createPaymentByAdmin = async (req, res) => {
    const { clientId, projectId, milestoneId, invoiceId, amount, method, status, stripeId, paypalId, paidAt } = req.body;

    if (!clientId || !projectId || amount === undefined || !method) {
        return res.status(400).json({ message: "Client ID, Project ID, Amount, and Method are required." });
    }

    try {
        const baseAmount = new Decimal(amount);
        let gstAmount = new Decimal(0);
        let totalAmount = baseAmount;
        let associatedInvoice;

        // If an invoiceId is provided, retrieve its details for GST calculation
        if (invoiceId) {
            associatedInvoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { gstEnabled: true, gstAmount: true, totalAmount: true }
            });

            if (!associatedInvoice) {
                return res.status(404).json({ message: "Associated Invoice not found." });
            }

            // If payment matches invoice total, use invoice's GST and total
            if (baseAmount.equals(associatedInvoice.amount)) {
                gstAmount = associatedInvoice.gstAmount;
                totalAmount = associatedInvoice.totalAmount;
            } else {
                // If partial payment or amount mismatch, recalculate based on project's GST setting or a default
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { gstEnabled: true }
                });
                if (project && project.gstEnabled) {
                    gstAmount = baseAmount.mul(new Decimal('0.10')); // Assuming 10% GST
                    totalAmount = baseAmount.add(gstAmount);
                }
            }
        } else {
            // If no invoice, check project's GST setting
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                select: { gstEnabled: true }
            });
            if (project && project.gstEnabled) {
                gstAmount = baseAmount.mul(new Decimal('0.10'));
                totalAmount = baseAmount.add(gstAmount);
            }
        }


        const newPayment = await prisma.payment.create({
            data: {
                clientId,
                projectId,
                milestoneId: milestoneId || undefined,
                invoiceId: invoiceId || undefined,
                amount: baseAmount,
                gstAmount: gstAmount,
                totalAmount: totalAmount,
                method,
                status: status || 'COMPLETED', // Admin typically records completed payments
                stripeId,
                paypalId,
                paidAt: paidAt ? new Date(paidAt) : new Date(), // Set paidAt if not provided, for completed payments
            },
        });

        // Update Invoice status if payment completes it
        if (invoiceId && newPayment.status === 'COMPLETED' && associatedInvoice && newPayment.totalAmount.equals(associatedInvoice.totalAmount)) {
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: { status: 'PAID', paidAt: new Date() }
            });
        }

        // Update Milestone status if payment completes it (e.g., if milestone.cost matches payment.totalAmount)
        if (milestoneId && newPayment.status === 'COMPLETED') {
            const milestone = await prisma.milestone.findUnique({
                where: { id: milestoneId },
                select: { cost: true }
            });
            if (milestone && newPayment.totalAmount.equals(milestone.cost)) {
                await prisma.milestone.update({
                    where: { id: milestoneId },
                    data: { status: 'PAID' }
                });
            }
        }


        res.status(201).json({ message: "Payment created successfully by Admin", payment: newPayment });
    } catch (error) {
        console.error("Admin: Create payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllPaymentsForAdmin = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(payments);
    } catch (error) {
        console.error("Admin: Get all payments error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPaymentByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
        });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        res.status(200).json(payment);
    } catch (error) {
        console.error("Admin: Get payment by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updatePaymentByAdmin = async (req, res) => {
    const { id } = req.params;
    const { amount, gstAmount, totalAmount, method, status, stripeId, paypalId, paidAt } = req.body;

    try {
        const updateData = {};
        if (amount !== undefined) updateData.amount = new Decimal(amount);
        if (gstAmount !== undefined) updateData.gstAmount = new Decimal(gstAmount);
        if (totalAmount !== undefined) updateData.totalAmount = new Decimal(totalAmount);
        if (method) updateData.method = method;
        if (status) updateData.status = status;
        if (stripeId !== undefined) updateData.stripeId = stripeId;
        if (paypalId !== undefined) updateData.paypalId = paypalId;
        if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null;

        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: updateData,
        });

        // Re-evaluate Invoice status if this payment is linked to one and its status changed
        if (updatedPayment.invoiceId && updatedPayment.status === 'COMPLETED') {
             const linkedInvoice = await prisma.invoice.findUnique({ where: { id: updatedPayment.invoiceId } });
             if (linkedInvoice && updatedPayment.totalAmount.equals(linkedInvoice.totalAmount)) { // Simple check, may need more robust logic for partial payments
                 await prisma.invoice.update({
                     where: { id: updatedPayment.invoiceId },
                     data: { status: 'PAID', paidAt: updatedPayment.paidAt || new Date() }
                 });
             }
        }
        // Re-evaluate Milestone status if this payment is linked to one
        if (updatedPayment.milestoneId && updatedPayment.status === 'COMPLETED') {
            const linkedMilestone = await prisma.milestone.findUnique({ where: { id: updatedPayment.milestoneId } });
            if (linkedMilestone && updatedPayment.totalAmount.equals(linkedMilestone.cost)) {
                await prisma.milestone.update({
                    where: { id: updatedPayment.milestoneId },
                    data: { status: 'PAID' }
                });
            }
        }


        res.status(200).json({ message: "Payment updated successfully by Admin", payment: updatedPayment });
    } catch (error) {
        console.error("Admin: Update payment error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Payment not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deletePaymentByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        // When deleting a payment, consider if it affects an invoice or milestone status.
        // If an invoice was marked PAID due to this payment, you might need to revert its status.
        const paymentToDelete = await prisma.payment.findUnique({ where: { id } });

        if (paymentToDelete && paymentToDelete.invoiceId && paymentToDelete.status === 'COMPLETED') {
            // Check if this payment was the sole reason for the invoice being 'PAID'
            // This logic can be complex for partial payments. For simplicity, we'll assume a direct relation.
            const invoice = await prisma.invoice.findUnique({ where: { id: paymentToDelete.invoiceId } });
            if (invoice && invoice.status === 'PAID') {
                // You might need more complex logic here to check if *all* payments for this invoice are deleted
                // or if it was a single payment that fully paid the invoice.
                // For now, let's revert to SENT if this was the paying payment.
                 if (paymentToDelete.totalAmount.equals(invoice.totalAmount)) { // If it was a full payment
                    await prisma.invoice.update({
                        where: { id: paymentToDelete.invoiceId },
                        data: { status: 'SENT', paidAt: null }
                    });
                 }
            }
        }

        if (paymentToDelete && paymentToDelete.milestoneId && paymentToDelete.status === 'COMPLETED') {
            const milestone = await prisma.milestone.findUnique({ where: { id: paymentToDelete.milestoneId } });
            if (milestone && milestone.status === 'PAID') {
                await prisma.milestone.update({
                    where: { id: paymentToDelete.milestoneId },
                    data: { status: 'COMPLETED' } // Revert to completed, or whatever previous status makes sense
                });
            }
        }

        await prisma.payment.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete payment error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Payment not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Client-specific Payment Routes ---

exports.getClientPayments = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            where: { clientId: req.user.id },
            include: {
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(payments);
    } catch (error) {
        console.error("Client: Get payments error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getClientPaymentById = async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await prisma.payment.findUnique({
            where: { id, clientId: req.user.id }, // Ensure payment belongs to the client
            include: {
                project: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
        });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found or you don't have access to it." });
        }
        res.status(200).json(payment);
    } catch (error) {
        console.error("Client: Get payment by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// This endpoint would initiate a payment via a payment gateway
exports.initiatePayment = async (req, res) => {
    const { invoiceId, amount, method } = req.body; // Client selects invoice and amount to pay

    if (!invoiceId || amount === undefined || !method) {
        return res.status(400).json({ message: "Invoice ID, amount, and payment method are required." });
    }

    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId, clientId: req.user.id },
            select: { id: true, invoiceNumber: true, totalAmount: true, status: true, projectId: true, milestoneId: true }
        });

        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found or does not belong to you." });
        }
        if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
            return res.status(400).json({ message: "This invoice is already paid or cancelled." });
        }

        const requestedAmount = new Decimal(amount);
        if (requestedAmount.lessThanOrEqualTo(0) || requestedAmount.greaterThan(invoice.totalAmount)) {
            return res.status(400).json({ message: "Invalid payment amount." });
        }

        // Simulate interaction with a payment gateway (Stripe/PayPal)
        // In a real app, this would involve calling the payment gateway API
        let transactionId = null;
        let paymentStatus = 'PENDING'; // Initial status before gateway confirms

        // Example: if (method === 'STRIPE') { const stripeResponse = await stripe.charges.create(...) }
        // For demonstration, let's assume immediate success if amount matches total
        if (requestedAmount.equals(invoice.totalAmount)) {
            paymentStatus = 'COMPLETED';
            transactionId = `MOCK_STRIPE_${Date.now()}`; // Mock ID
        } else {
             paymentStatus = 'PROCESSING'; // For partial payments, or if gateway needs time
             transactionId = `MOCK_PAYPAL_${Date.now()}`; // Mock ID
        }

        const newPayment = await prisma.payment.create({
            data: {
                clientId: req.user.id,
                projectId: invoice.projectId,
                milestoneId: invoice.milestoneId,
                invoiceId: invoice.id,
                amount: requestedAmount,
                gstAmount: invoice.gstAmount.mul(requestedAmount.div(invoice.totalAmount)), // Prorated GST for partial
                totalAmount: requestedAmount, // Total client is actually paying
                method,
                status: paymentStatus,
                stripeId: method === 'STRIPE' ? transactionId : null,
                paypalId: method === 'PAYPAL' ? transactionId : null,
                paidAt: paymentStatus === 'COMPLETED' ? new Date() : null,
            },
        });

        // Update invoice status if fully paid
        if (newPayment.status === 'COMPLETED' && newPayment.totalAmount.equals(invoice.totalAmount)) {
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: { status: 'PAID', paidAt: new Date() }
            });
            // Also update milestone status if applicable
            if (invoice.milestoneId) {
                await prisma.milestone.update({
                    where: { id: invoice.milestoneId },
                    data: { status: 'PAID' }
                });
            }
        } else if (newPayment.status === 'PROCESSING') {
            // For partial payments, you might update invoice status to 'PARTIALLY_PAID'
            // (Requires adding PARTIALLY_PAID to InvoiceStatus enum)
            // Or just keep it as 'SENT'/'OVERDUE' until fully paid.
        }

        res.status(201).json({
            message: `Payment initiated successfully. Status: ${newPayment.status}`,
            payment: newPayment,
            redirectUrl: paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING' ? `https://mock-payment-gateway.com/pay/${transactionId}` : null // Simulate redirect
        });

    } catch (error) {
        console.error("Client: Initiate payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};