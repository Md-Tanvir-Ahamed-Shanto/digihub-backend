const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- Client-facing Maintenance Subscription ---

exports.getMyMaintenanceSubscription = async (req, res) => {
    const clientId = req.user.id; // Authenticated client's ID

    try {
        const subscription = await prisma.maintenanceSubscription.findUnique({
            where: { clientId: clientId },
            select: {
                id: true,
                pricePerMonth: true,
                status: true,
                nextBillingDate: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                updatedAt: true,
                // Include related payments
                payments: {
                    orderBy: {
                        createdAt: 'desc', // Order payments by most recent
                    },
                    select: {
                        id: true,
                        amount: true, // This is now totalAmount in simplified schema
                        status: true,
                        paidAt: true,
                        // Add other fields you want to show in history
                    }
                },
            },
        });

        if (!subscription) {
            // It's okay if a client doesn't have a subscription yet.
            // Return 404 to indicate no subscription found, frontend will handle.
            return res.status(404).json({ message: "No maintenance subscription found for this client." });
        }

        res.status(200).json(subscription);
    } catch (error) {
        console.error("Error fetching client's maintenance subscription:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


// --- Admin-facing Maintenance Subscription Management ---

exports.getAllSubscriptionsForAdmin = async (req, res) => {
    try {
        const subscriptions = await prisma.maintenanceSubscription.findMany({
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc', // Or by nextBillingDate 'asc'
            },
        });
        res.status(200).json(subscriptions);
    } catch (error) {
        console.error("Admin: Error fetching all maintenance subscriptions:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route GET /api/subscriptions/:id
 * @desc Admin: Get a specific maintenance subscription by ID
 * @access Private (Admin only)
 */
exports.getSubscriptionByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const subscription = await prisma.maintenanceSubscription.findUnique({
            where: { id },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        phone: true,
                        isActive: true,
                    },
                },
                payments: {
                    orderBy: { paidAt: 'desc' }
                }
            },
        });

        if (!subscription) {
            return res.status(404).json({ message: "Maintenance subscription not found." });
        }
        res.status(200).json(subscription);
    } catch (error) {
        console.error("Admin: Error fetching maintenance subscription by ID:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route POST /api/subscriptions
 * @desc Admin: Create a new maintenance subscription for a client
 * @access Private (Admin only)
 * Note: A client can only have one subscription due to `@unique clientId`
 */
exports.createSubscriptionByAdmin = async (req, res) => {
    const { clientId, pricePerMonth, status, gatewaySubscriptionId, nextBillingDate, startDate, endDate } = req.body;

    if (!clientId || !pricePerMonth || !nextBillingDate) {
        return res.status(400).json({ message: "Client ID, price per month, and next billing date are required." });
    }

    try {
        // Check if client exists
        const clientExists = await prisma.client.findUnique({ where: { id: clientId } });
        if (!clientExists) {
            return res.status(404).json({ message: "Client not found." });
        }

        // Check if client already has a subscription
        const existingSubscription = await prisma.maintenanceSubscription.findUnique({ where: { clientId } });
        if (existingSubscription) {
            return res.status(409).json({ message: "Client already has an existing maintenance subscription. Update it instead." });
        }

        const newSubscription = await prisma.maintenanceSubscription.create({
            data: {
                clientId,
                pricePerMonth: parseFloat(pricePerMonth),
                status: status || 'ACTIVE', // Default to ACTIVE
                gatewaySubscriptionId,
                nextBillingDate: new Date(nextBillingDate),
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            },
        });
        res.status(201).json({ message: "Maintenance subscription created successfully.", subscription: newSubscription });
    } catch (error) {
        console.error("Admin: Error creating maintenance subscription:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('clientId')) {
            return res.status(409).json({ message: "A subscription for this client already exists." });
        }
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route PUT /api/subscriptions/:id
 * @desc Admin: Update a maintenance subscription
 * @access Private (Admin only)
 */
exports.updateSubscriptionByAdmin = async (req, res) => {
    const { id } = req.params;
    const { pricePerMonth, status, gatewaySubscriptionId, nextBillingDate, startDate, endDate } = req.body;

    try {
        const existingSubscription = await prisma.maintenanceSubscription.findUnique({ where: { id } });
        if (!existingSubscription) {
            return res.status(404).json({ message: "Maintenance subscription not found." });
        }

        const updatedSubscription = await prisma.maintenanceSubscription.update({
            where: { id },
            data: {
                pricePerMonth: pricePerMonth !== undefined ? parseFloat(pricePerMonth) : undefined,
                status: status !== undefined ? status : undefined,
                gatewaySubscriptionId: gatewaySubscriptionId !== undefined ? gatewaySubscriptionId : undefined,
                nextBillingDate: nextBillingDate !== undefined ? new Date(nextBillingDate) : undefined,
                startDate: startDate !== undefined ? new Date(startDate) : undefined,
                endDate: endDate !== undefined ? new Date(endDate) : undefined,
            },
        });
        res.status(200).json({ message: "Maintenance subscription updated successfully.", subscription: updatedSubscription });
    } catch (error) {
        console.error("Admin: Error updating maintenance subscription:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

/**
 * @route DELETE /api/subscriptions/:id
 * @desc Admin: Delete a maintenance subscription
 * @access Private (Admin only)
 */
exports.deleteSubscriptionByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const subscriptionToDelete = await prisma.maintenanceSubscription.findUnique({ where: { id } });
        if (!subscriptionToDelete) {
            return res.status(404).json({ message: "Maintenance subscription not found." });
        }

        await prisma.maintenanceSubscription.delete({ where: { id } });
        res.status(204).send(); // No Content
    } catch (error) {
        console.error("Admin: Error deleting maintenance subscription:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Maintenance subscription not found.' });
        }
        if (error.code === 'P2003') { // Foreign key constraint (e.g., if payments are tied and onDelete is RESTRICT)
             return res.status(409).json({ message: 'Cannot delete subscription due to existing related payments. Delete payments first.' });
        }
        res.status(500).json({ message: "Internal server error." });
    }
};