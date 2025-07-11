// src/controllers/maintenanceController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

// --- Maintenance Plan Management (Admin Only) ---

exports.createMaintenancePlan = async (req, res) => {
    const { name, description, price, billingCycle, features, isActive } = req.body;

    if (!name || price === undefined || !billingCycle || !Array.isArray(features)) {
        return res.status(400).json({ message: "Name, price, billing cycle, and features are required to create a plan." });
    }
    if (new Decimal(price).lessThanOrEqualTo(0)) {
        return res.status(400).json({ message: "Price must be a positive number." });
    }
    if (!['MONTHLY', 'ANNUALLY'].includes(billingCycle)) {
        return res.status(400).json({ message: "Invalid billing cycle. Must be MONTHLY or ANNUALLY." });
    }

    try {
        const newPlan = await prisma.maintenancePlan.create({
            data: {
                name,
                description,
                price: new Decimal(price),
                billingCycle,
                features,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        res.status(201).json({ message: "Maintenance plan created successfully", plan: newPlan });
    } catch (error) {
        console.error("Create maintenance plan error:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
            return res.status(409).json({ message: "A plan with this name already exists." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllMaintenancePlans = async (req, res) => {
    try {
        const plans = await prisma.maintenancePlan.findMany({
            orderBy: { price: 'asc' }
        });
        res.status(200).json(plans);
    } catch (error) {
        console.error("Get all maintenance plans error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateMaintenancePlan = async (req, res) => {
    const { id } = req.params;
    const { name, description, price, billingCycle, features, isActive } = req.body;

    try {
        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) {
            const newPrice = new Decimal(price);
            if (newPrice.lessThanOrEqualTo(0)) {
                return res.status(400).json({ message: "Price must be a positive number." });
            }
            updateData.price = newPrice;
        }
        if (billingCycle && ['MONTHLY', 'ANNUALLY'].includes(billingCycle)) {
            updateData.billingCycle = billingCycle;
        } else if (billingCycle) {
            return res.status(400).json({ message: "Invalid billing cycle. Must be MONTHLY or ANNUALLY." });
        }
        if (Array.isArray(features)) updateData.features = features;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedPlan = await prisma.maintenancePlan.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Maintenance plan updated successfully", plan: updatedPlan });
    } catch (error) {
        console.error("Update maintenance plan error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Maintenance plan not found." });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
            return res.status(409).json({ message: "A plan with this name already exists." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteMaintenancePlan = async (req, res) => {
    const { id } = req.params;
    try {
        // Check if there are active subscriptions using this plan
        const activeSubscriptions = await prisma.maintenanceSubscription.count({
            where: { planId: id, status: 'ACTIVE' }
        });
        if (activeSubscriptions > 0) {
            return res.status(400).json({ message: "Cannot delete plan with active subscriptions. Deactivate it instead." });
        }

        await prisma.maintenancePlan.delete({ where: { id } });
        res.status(204).send(); // No content
    } catch (error) {
        console.error("Delete maintenance plan error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Maintenance plan not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

// --- Maintenance Subscription Management (Admin & Client) ---

// Admin: Create/Assign a subscription for a client
exports.createSubscriptionByAdmin = async (req, res) => {
    const { clientId, planId, startDate, paymentMethodRef, autoRenew, projectId } = req.body;

    if (!clientId || !planId || !startDate || !paymentMethodRef) {
        return res.status(400).json({ message: "Client ID, Plan ID, Start Date, and Payment Method Reference are required." });
    }

    try {
        const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
        if (!plan) {
            return res.status(404).json({ message: "Maintenance plan not found." });
        }

        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
            return res.status(404).json({ message: "Client not found." });
        }

        // Calculate next billing date
        const startDateTime = new Date(startDate);
        let nextBillingDate = new Date(startDateTime);
        if (plan.billingCycle === 'MONTHLY') {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else { // ANNUALLY
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        }

        const newSubscription = await prisma.maintenanceSubscription.create({
            data: {
                clientId,
                planId,
                startDate: startDateTime,
                nextBillingDate,
                paymentMethodRef,
                autoRenew: autoRenew !== undefined ? autoRenew : true,
                status: 'ACTIVE',
                projectId: projectId || null,
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                plan: true,
                project: { select: { id: true, title: true }}
            }
        });
        res.status(201).json({ message: "Subscription created successfully by Admin", subscription: newSubscription });
    } catch (error) {
        console.error("Admin: Create subscription error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Client: Subscribe to a plan (requires client to provide payment details)
exports.subscribeToPlanByClient = async (req, res) => {
    const { planId, paymentMethodRef, autoRenew, projectId } = req.body;
    const clientId = req.user.id;

    if (!planId || !paymentMethodRef) {
        return res.status(400).json({ message: "Plan ID and payment method are required to subscribe." });
    }

    try {
        const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId, isActive: true } });
        if (!plan) {
            return res.status(404).json({ message: "Maintenance plan not found or is not active." });
        }

        // Check for existing active subscription to prevent double-subscription
        const existingSubscription = await prisma.maintenanceSubscription.findFirst({
            where: { clientId, status: 'ACTIVE' } // Or specific to planId if multiple concurrent subs allowed
        });
        if (existingSubscription) {
            return res.status(400).json({ message: "You already have an active subscription." });
        }

        // Simulate initial payment processing
        // In a real scenario, this would involve calling Stripe/PayPal API to create a subscription,
        // which would return a subscription ID or confirm the payment.
        // For simplicity, we assume the paymentMethodRef is valid and initial charge is successful.
        // const initialChargeSuccess = await processInitialPayment(clientId, plan.price, paymentMethodRef);
        // if (!initialChargeSuccess) {
        //     return res.status(400).json({ message: "Initial payment failed. Please check your payment details." });
        // }

        const now = new Date();
        let nextBillingDate = new Date(now);
        if (plan.billingCycle === 'MONTHLY') {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else { // ANNUALLY
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        }

        const newSubscription = await prisma.maintenanceSubscription.create({
            data: {
                clientId,
                planId,
                startDate: now,
                nextBillingDate,
                lastPaymentDate: now, // Initial payment
                paymentMethodRef,
                autoRenew: autoRenew !== undefined ? autoRenew : true,
                status: 'ACTIVE',
                projectId: projectId || null,
            },
            include: {
                plan: true,
                project: { select: { id: true, title: true }}
            }
        });
        res.status(201).json({ message: "Subscription created successfully", subscription: newSubscription });
    } catch (error) {
        console.error("Client: Subscribe to plan error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get subscriptions (Admin can get all, Client can get theirs)
exports.getSubscriptions = async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.id;
    let whereClause = {};

    if (userRole === 'CLIENT') {
        whereClause.clientId = userId;
    }
    // Admin can fetch all, or filter by client ID if provided in query
    if (userRole === 'ADMIN' && req.query.clientId) {
        whereClause.clientId = req.query.clientId;
    }

    try {
        const subscriptions = await prisma.maintenanceSubscription.findMany({
            where: whereClause,
            include: {
                client: { select: { id: true, name: true, email: true } },
                plan: true,
                project: { select: { id: true, title: true }}
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(subscriptions);
    } catch (error) {
        console.error("Get subscriptions error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getSubscriptionById = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    try {
        const subscription = await prisma.maintenanceSubscription.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true } },
                plan: true,
                project: { select: { id: true, title: true }}
            },
        });

        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found." });
        }

        // Ensure clients can only view their own subscriptions
        if (userRole === 'CLIENT' && subscription.clientId !== userId) {
            return res.status(403).json({ message: "Access denied. You can only view your own subscriptions." });
        }

        res.status(200).json(subscription);
    } catch (error) {
        console.error("Get subscription by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update subscription status (Admin can update any, Client can cancel/toggle autoRenew their own)
exports.updateSubscription = async (req, res) => {
    const { id } = req.params;
    const { status, autoRenew, nextBillingDate, paymentMethodRef, endDate, projectId } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    try {
        const existingSubscription = await prisma.maintenanceSubscription.findUnique({
            where: { id },
            select: { clientId: true, status: true }
        });

        if (!existingSubscription) {
            return res.status(404).json({ message: "Subscription not found." });
        }

        // Ensure clients can only update their own subscriptions
        if (userRole === 'CLIENT' && existingSubscription.clientId !== userId) {
            return res.status(403).json({ message: "Access denied. You can only manage your own subscriptions." });
        }

        const updateData = {};
        if (nextBillingDate) updateData.nextBillingDate = new Date(nextBillingDate);
        if (paymentMethodRef) updateData.paymentMethodRef = paymentMethodRef;
        if (endDate) updateData.endDate = new Date(endDate);
        if (projectId !== undefined) updateData.projectId = projectId; // Allow setting/clearing project ID

        // Admin can set any status. Client can only CANCEL or toggle autoRenew.
        if (userRole === 'ADMIN' && status) {
            if (!['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED', 'TRIAL'].includes(status)) {
                return res.status(400).json({ message: "Invalid subscription status." });
            }
            updateData.status = status;
            if (status === 'CANCELLED' && !updateData.endDate) {
                updateData.endDate = new Date(); // Set cancellation date
            } else if (status === 'ACTIVE' && existingSubscription.status === 'CANCELLED') {
                // If reactivating from cancelled, remove endDate and reset nextBillingDate appropriately
                updateData.endDate = null;
                // This logic needs to be more robust: new startDate, new nextBillingDate.
                // For simplicity, let's say it just removes end date. Re-subscribing might be better flow.
            }
        } else if (userRole === 'CLIENT' && status === 'CANCELLED') {
            updateData.status = 'CANCELLED';
            updateData.endDate = new Date(); // Client cancelling, set end date to now
            updateData.autoRenew = false; // Cancellation implies no auto-renewal
        } else if (userRole === 'CLIENT' && status && status !== existingSubscription.status) {
            return res.status(403).json({ message: "Clients can only change subscription status to 'CANCELLED'." });
        }

        if (autoRenew !== undefined) {
            updateData.autoRenew = autoRenew;
        }

        const updatedSubscription = await prisma.maintenanceSubscription.update({
            where: { id },
            data: updateData,
            include: {
                client: { select: { id: true, name: true, email: true } },
                plan: true,
                project: { select: { id: true, title: true }}
            }
        });
        res.status(200).json({ message: "Subscription updated successfully", subscription: updatedSubscription });
    } catch (error) {
        console.error("Update subscription error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Subscription not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

// Admin can delete any subscription
exports.deleteSubscriptionByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.maintenanceSubscription.delete({ where: { id } });
        res.status(204).send(); // No content
    } catch (error) {
        console.error("Admin: Delete subscription error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Subscription not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

// --- Internal/Automated Payment Processing (Placeholder) ---
// This function would typically be called by a cron job or a payment gateway webhook.
// It is NOT exposed via a direct API route for security.
exports.processRecurringPayment = async (subscriptionId) => {
    try {
        const subscription = await prisma.maintenanceSubscription.findUnique({
            where: { id: subscriptionId },
            include: { client: true, plan: true }
        });

        if (!subscription || subscription.status !== 'ACTIVE' || !subscription.autoRenew) {
            console.log(`Subscription ${subscriptionId} not eligible for recurring payment.`);
            return false;
        }

        const { client, plan, paymentMethodRef } = subscription;

        if (!paymentMethodRef) {
            console.error(`Subscription ${subscriptionId} missing payment method reference.`);
            // Potentially update subscription status to 'PENDING_PAYMENT' or 'NEEDS_ATTENTION'
            return false;
        }

        // Simulate payment gateway interaction
        console.log(`Attempting to charge ${plan.price} from ${client.email} for subscription ${subscription.id} using ref: ${paymentMethodRef}`);

        // --- REAL PAYMENT GATEWAY INTEGRATION GOES HERE ---
        // Example:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.create({
        //     amount: plan.price.times(100).toNumber(), // Amount in cents
        //     currency: 'aud', // or your currency
        //     customer: paymentMethodRef, // Assuming paymentMethodRef is a Stripe Customer ID
        //     confirm: true,
        //     off_session: true, // For recurring payments
        // });
        // if (paymentIntent.status === 'succeeded') { ... } else { ... }

        const paymentSuccess = Math.random() > 0.1; // 90% success rate mock

        if (paymentSuccess) {
            const nextBillingDate = new Date(subscription.nextBillingDate);
            if (plan.billingCycle === 'MONTHLY') {
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            } else {
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            }

            await prisma.maintenanceSubscription.update({
                where: { id: subscriptionId },
                data: {
                    lastPaymentDate: new Date(),
                    nextBillingDate: nextBillingDate,
                    status: 'ACTIVE' // Ensure it stays active
                }
            });

            // Create a payment record (similar to initiatePayment)
            await prisma.payment.create({
                data: {
                    clientId: client.id,
                    maintenanceSubscriptionId: subscription.id, // Link to subscription
                    amount: plan.price,
                    gstAmount: plan.price.mul(new Decimal('0.10')), // Assuming 10% GST
                    totalAmount: plan.price.mul(new Decimal('1.10')),
                    method: 'AUTOMATIC_RECURRING', // Or specific gateway used
                    status: 'COMPLETED',
                    paidAt: new Date(),
                    // Add stripeId/paypalId from actual payment gateway response
                }
            });

            console.log(`Successfully processed recurring payment for subscription ${subscriptionId}. Next billing: ${nextBillingDate.toISOString().split('T')[0]}`);
            return true;
        } else {
            console.error(`Failed to process recurring payment for subscription ${subscriptionId}.`);
            // Update subscription status to reflect failed payment, e.g., 'PAYMENT_FAILED'
            await prisma.maintenanceSubscription.update({
                where: { id: subscriptionId },
                data: { status: 'PAUSED' } // Or 'PAYMENT_FAILED' if you add it to enum
            });
            // Send notification to client
            return false;
        }
    } catch (error) {
        console.error(`Error in processRecurringPayment for subscription ${subscriptionId}:`, error);
        await prisma.maintenanceSubscription.update({
            where: { id: subscriptionId },
            data: { status: 'PAUSED' } // Set to paused on error
        });
        return false;
    }
};

// Example of how you might trigger processRecurringPayment externally (e.g., in a cron job file)
// const subscriptionsDue = await prisma.maintenanceSubscription.findMany({
//     where: {
//         nextBillingDate: { lte: new Date() }, // Due today or earlier
//         status: 'ACTIVE',
//         autoRenew: true
//     }
// });
// for (const sub of subscriptionsDue) {
//     await exports.processRecurringPayment(sub.id);
// }