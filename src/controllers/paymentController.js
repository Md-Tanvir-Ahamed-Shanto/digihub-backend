const { PrismaClient } = require("../generated/prisma");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const prisma = new PrismaClient();

// Helper to calculate amounts (assuming 15% GST)
const calculateAmounts = (baseAmount) => {
    const GST_RATE = 0.15; // 15% GST in Bangladesh
    const gstAmount = baseAmount * GST_RATE;
    const totalAmount = baseAmount + gstAmount;
    const totalAmountInCents = Math.round(totalAmount * 100); // Stripe uses cents

    return { amount: baseAmount, gstAmount, totalAmount, totalAmountInCents };
};

// --- Client-facing Payment Intent Creation ---

/**
 * @route POST /api/payments/create-project-payment-intent
 * @desc Create a Stripe PaymentIntent for a project/invoice payment
 * @access Private (Client only)
 * Body: { projectId?, invoiceId?, milestoneId?, amount }
 */
exports.createPaymentIntent = async (req, res) => {
    const { projectId, invoiceId, milestoneId, amount: requestedAmount } = req.body;
    const clientId = req.user.id; // From authMiddleware

    if (!requestedAmount || requestedAmount <= 0) {
        return res.status(400).json({ message: "Amount is required and must be positive." });
    }

    try {
        let paymentPurpose = "General Payment";
        let clientReferenceId = null; // To link to the specific entity (project, invoice, etc.)

        // Determine payment purpose and client reference
        if (invoiceId) {
            const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId, clientId: clientId } });
            if (!invoice) return res.status(404).json({ message: "Invoice not found or does not belong to client." });
            paymentPurpose = `Invoice ${invoice.invoiceNumber}`;
            clientReferenceId = invoice.id;
        } else if (projectId) {
            const project = await prisma.project.findUnique({ where: { id: projectId, clientId: clientId } });
            if (!project) return res.status(404).json({ message: "Project not found or does not belong to client." });
            paymentPurpose = `Project: ${project.name}`;
            clientReferenceId = project.id;
        } else if (milestoneId) {
            const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, project: { clientId: clientId } } });
            if (!milestone) return res.status(404).json({ message: "Milestone not found or does not belong to client's project." });
            paymentPurpose = `Milestone: ${milestone.name}`;
            clientReferenceId = milestone.id;
        } else {
            // This is a general payment without a specific project/invoice/milestone link
            // You might require one of these, or handle general payments differently.
        }

        const { totalAmount, totalAmountInCents } = calculateAmounts(parseFloat(requestedAmount));

        // Create a PENDING payment record
        const newPayment = await prisma.payment.create({
            data: {
                amount: new PrismaClient()._d(totalAmount), // Store total amount paid
                method: 'ONLINE',
                status: 'PENDING',
                clientId: clientId,
                projectId: projectId || undefined,
                invoiceId: invoiceId || undefined,
                milestoneId: milestoneId || undefined,
                // maintenanceSubscriptionId is not for this route
            },
        });

        // Create PaymentIntent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountInCents,
            currency: 'bdt', // Your currency
            payment_method_types: ['card'],
            description: `Payment for ${paymentPurpose} by Client ${clientId}`,
            metadata: {
                paymentId: newPayment.id,
                clientId: clientId,
                // Add specific IDs for webhook processing
                projectId: projectId || undefined,
                invoiceId: invoiceId || undefined,
                milestoneId: milestoneId || undefined,
                type: 'GENERAL_PAYMENT',
            },
            capture_method: 'automatic',
        });

        // Update the payment record with Stripe PaymentIntent ID and gateway
        await prisma.payment.update({
            where: { id: newPayment.id },
            data: {
                transactionId: paymentIntent.id,
                gateway: 'STRIPE',
            },
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ message: "Failed to create payment intent." });
    }
};

/**
 * @route POST /api/payments/create-subscription-payment-intent
 * @desc Create a Stripe PaymentIntent for a maintenance subscription payment
 * @access Private (Client only)
 * Body: { maintenanceSubscriptionId }
 */
exports.createSubscriptionPaymentIntent = async (req, res) => {
    const { maintenanceSubscriptionId } = req.body;
    const clientId = req.user.id; // From authMiddleware

    try {
        if (!maintenanceSubscriptionId) {
            return res.status(400).json({ message: "Maintenance Subscription ID is required." });
        }

        const subscription = await prisma.maintenanceSubscription.findUnique({
            where: { id: maintenanceSubscriptionId, clientId: clientId }, // Ensure client owns subscription
        });

        if (!subscription) {
            // If subscription not found, or doesn't belong to the client, or is already active and paid for this period
            return res.status(404).json({ message: "Maintenance subscription not found or does not belong to this client." });
        }

        // Use the subscription's pricePerMonth as the base for the payment intent
        // Convert Prisma Decimal to a JavaScript number before calculations
        const { totalAmount, totalAmountInCents } = calculateAmounts(subscription.pricePerMonth.toNumber());

        // Create a PENDING payment record
        const newPayment = await prisma.payment.create({
            data: {
                amount: new PrismaClient()._d(totalAmount), // Store total amount paid (as Decimal)
                method: 'ONLINE',
                status: 'PENDING', // Initial status
                clientId: clientId,
                maintenanceSubscriptionId: subscription.id,
            },
        });

        // Create PaymentIntent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountInCents,
            currency: 'bdt', // Your currency
            payment_method_types: ['card'],
            description: `Maintenance Subscription Payment for Client ${clientId} (Subscription: ${subscription.id})`,
            metadata: {
                paymentId: newPayment.id,
                clientId: clientId,
                maintenanceSubscriptionId: subscription.id,
                type: 'MAINTENANCE_SUBSCRIPTION_PAYMENT',
            },
            capture_method: 'automatic',
        });

        // Update the payment record with Stripe PaymentIntent ID and gateway
        await prisma.payment.update({
            where: { id: newPayment.id },
            data: {
                transactionId: paymentIntent.id,
                gateway: 'STRIPE',
            },
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error("Error creating subscription payment intent:", error);
        res.status(500).json({ message: "Failed to create payment intent." });
    }
};

/**
 * @route POST /api/payments/webhook
 * @desc Stripe Webhook endpoint
 * @access Public (Stripe only)
 * Note: Body needs to be raw (no express.json())
 */
exports.stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object;
            const { paymentId, maintenanceSubscriptionId, clientId, type } = paymentIntentSucceeded.metadata;

            if (paymentId) {
                try {
                    // Update the payment record
                    const updatedPayment = await prisma.payment.update({
                        where: { id: paymentId },
                        data: {
                            status: 'COMPLETED',
                            paidAt: new Date(),
                            // transactionId and gateway should already be set during intent creation
                        },
                    });
                    console.log(`Payment ${paymentId} status updated to COMPLETED.`);

                    // If it's a maintenance subscription payment, update subscription status and next billing date
                    if (type === 'MAINTENANCE_SUBSCRIPTION_PAYMENT' && maintenanceSubscriptionId) {
                        // Find the subscription to get its current nextBillingDate and price
                        const subscription = await prisma.maintenanceSubscription.findUnique({
                            where: { id: maintenanceSubscriptionId },
                        });

                        if (subscription) {
                            // Calculate new nextBillingDate
                            // If startDate is not set, set it now. If nextBillingDate is past, use it.
                            let newNextBillingDate;
                            if (!subscription.startDate) {
                                newNextBillingDate = new Date(); // Start date is now
                                newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1); // Next bill is 1 month from now
                            } else if (subscription.nextBillingDate && new Date() > subscription.nextBillingDate) {
                                // If current date is past nextBillingDate, calculate from current date
                                newNextBillingDate = new Date();
                                newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
                            } else if (subscription.nextBillingDate) {
                                // If nextBillingDate is in the future, just increment from it
                                newNextBillingDate = new Date(subscription.nextBillingDate);
                                newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
                            } else {
                                // Fallback if nextBillingDate somehow missing
                                newNextBillingDate = new Date();
                                newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
                            }


                            await prisma.maintenanceSubscription.update({
                                where: { id: maintenanceSubscriptionId },
                                data: {
                                    status: 'ACTIVE',
                                    startDate: subscription.startDate || new Date(), // Set if null
                                    nextBillingDate: newNextBillingDate,
                                    // You might also want to update endDate if it's a fixed term
                                },
                            });
                            console.log(`Subscription ${maintenanceSubscriptionId} status updated to ACTIVE and next billing date set.`);
                        }
                    }

                    // Handle other payment types (project, invoice, milestone) if needed
                    if (type === 'GENERAL_PAYMENT' && (paymentIntentSucceeded.metadata.invoiceId || paymentIntentSucceeded.metadata.projectId)) {
                        // Logic to update invoice status (e.g., amountPaid, status to PAID/PARTIALLY_PAID)
                        // Or project status
                        // Example for invoice:
                        const invoiceId = paymentIntentSucceeded.metadata.invoiceId;
                        if (invoiceId) {
                            const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
                            if (invoice) {
                                const newAmountPaid = invoice.amountPaid.toNumber() + updatedPayment.amount.toNumber();
                                await prisma.invoice.update({
                                    where: { id: invoiceId },
                                    data: {
                                        amountPaid: new PrismaClient()._d(newAmountPaid),
                                        status: newAmountPaid >= invoice.amountDue.toNumber() ? 'PAID' : 'PARTIALLY_PAID',
                                    },
                                });
                                console.log(`Invoice ${invoiceId} updated with payment.`);
                            }
                        }
                    }

                } catch (dbError) {
                    console.error(`Database update error for payment ${paymentId}:`, dbError);
                    // Consider logging this or sending to an error tracking service
                }
            }
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object;
            const failedPaymentId = paymentIntentFailed.metadata.paymentId;

            if (failedPaymentId) {
                try {
                    await prisma.payment.update({
                        where: { id: failedPaymentId },
                        data: {
                            status: 'FAILED',
                            // You might also want to clear transactionId or set a failure message
                        },
                    });
                    console.log(`Payment ${failedPaymentId} status updated to FAILED.`);

                    if (paymentIntentFailed.metadata.type === 'MAINTENANCE_SUBSCRIPTION_PAYMENT' && paymentIntentFailed.metadata.maintenanceSubscriptionId) {
                        await prisma.maintenanceSubscription.update({
                            where: { id: paymentIntentFailed.metadata.maintenanceSubscriptionId },
                            data: {
                                status: 'INACTIVE', // Mark subscription as inactive on failed payment
                            },
                        });
                        console.log(`Subscription ${paymentIntentFailed.metadata.maintenanceSubscriptionId} status updated to INACTIVE due to failed payment.`);
                    }

                } catch (dbError) {
                    console.error(`Database update error for failed payment ${failedPaymentId}:`, dbError);
                }
            }
            break;

        // Add other event types you want to handle (e.g., `invoice.payment_succeeded` for Stripe Billing subscriptions)
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
};


// --- Admin-facing Payment Management ---

/**
 * @route GET /api/payments
 * @desc Admin: Get all payments
 * @access Private (Admin only)
 */
exports.getAllPaymentsForAdmin = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                client: {
                    select: { id: true, name: true, email: true, companyName: true }
                },
                project: { select: { id: true, name: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
                milestone: { select: { id: true, name: true } },
                maintenanceSubscription: { select: { id: true, pricePerMonth: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(payments);
    } catch (error) {
        console.error("Admin: Error fetching all payments:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route GET /api/payments/:id
 * @desc Admin: Get a single payment by ID
 * @access Private (Admin only)
 */
exports.getPaymentByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                client: {
                    select: { id: true, name: true, email: true, companyName: true }
                },
                project: { select: { id: true, name: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
                milestone: { select: { id: true, name: true } },
                maintenanceSubscription: { select: { id: true, pricePerMonth: true } },
            },
        });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found." });
        }
        res.status(200).json(payment);
    } catch (error) {
        console.error("Admin: Error fetching payment by ID:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route PUT /api/payments/:id/status
 * @desc Admin: Update payment status
 * @access Private (Admin only)
 * Body: { status: "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "CANCELLED" }
 */
exports.updatePaymentStatusByAdmin = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: "Payment status is required." });
    }

    try {
        const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid payment status provided." });
        }

        const existingPayment = await prisma.payment.findUnique({ where: { id } });
        if (!existingPayment) {
            return res.status(404).json({ message: "Payment not found." });
        }

        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: {
                status: status,
                paidAt: status === 'COMPLETED' && !existingPayment.paidAt ? new Date() : existingPayment.paidAt,
            },
        });
        res.status(200).json({ message: "Payment status updated successfully.", payment: updatedPayment });
    } catch (error) {
        console.error("Admin: Error updating payment status:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route DELETE /api/payments/:id
 * @desc Admin: Delete a payment
 * @access Private (Admin only)
 */
exports.deletePaymentByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const paymentToDelete = await prisma.payment.findUnique({ where: { id } });
        if (!paymentToDelete) {
            return res.status(404).json({ message: "Payment not found." });
        }

        await prisma.payment.delete({ where: { id } });
        res.status(204).send(); // No Content
    } catch (error) {
        console.error("Admin: Error deleting payment:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Payment not found.' });
        }
        res.status(500).json({ message: "Internal server error." });
    }
};