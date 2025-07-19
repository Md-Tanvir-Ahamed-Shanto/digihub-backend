const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

// --- Partner-specific Withdrawal Routes (Initiated by Partner) ---

exports.requestWithdrawal = async (req, res) => {
    // Destructure only the fields present in your provided Withdrawal model
    const {
        amount,
        note,
        type // This is crucial for determining required fields, but specific details won't be stored
    } = req.body;

    // Validate base fields
    if (!amount || new Decimal(amount).lessThanOrEqualTo(0)) {
        return res.status(400).json({ message: "A valid amount is required for withdrawal." });
    }
    if (!type) {
        return res.status(400).json({ message: "Withdrawal method type is required (PAYPAL, BANK_ACCOUNT)." });
    }
    // Updated: Only check for the types explicitly allowed in your enum, removed CREDIT_CARD as it's not a typical withdrawal type for partners
    if (!['PAYPAL', 'BANK_ACCOUNT'].includes(type)) {
        return res.status(400).json({ message: "Invalid withdrawal method type. Must be PAYPAL or BANK_ACCOUNT." });
    }

    // Removed: Conditional validation for specific credential fields (paypalEmail, bankName, etc.)
    // because these fields are NOT in your current Withdrawal model.
    // If you need to validate these, they should be stored elsewhere or
    // added back to the Withdrawal model in your schema.prisma.

    try {
        const partner = await prisma.partner.findUnique({
            where: { id: req.user.id },
            select: { availableBalance: true } // Ensure this matches your Partner model field name
        });

        if (!partner) {
            return res.status(404).json({ message: "Partner not found." });
        }

        const requestedAmount = new Decimal(amount);
        if (requestedAmount.greaterThan(partner.availableBalance)) {
            return res.status(400).json({ message: "Requested amount exceeds available balance." });
        }

        const newWithdrawal = await prisma.withdrawal.create({
            data: {
                amount: requestedAmount,
                status: 'PENDING',
                partnerId: req.user.id,
                note: note || null,
                type, // Only store the type, not specific credentials
            }
        });

        // Deduct from partner's availableBalance immediately upon request
        await prisma.partner.update({
            where: { id: req.user.id },
            data: {
                availableBalance: { // Ensure this matches your Partner model field name
                    decrement: requestedAmount
                }
            }
        });

        res.status(201).json({ message: "Withdrawal request submitted successfully", withdrawal: newWithdrawal });
    } catch (error) {
        console.error("Partner: Request withdrawal error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerWithdrawals = async (req, res) => {
    try {
        const withdrawals = await prisma.withdrawal.findMany({
            where: { partnerId: req.user.id },
            orderBy: { requestedAt: 'desc' }
        });
        res.status(200).json(withdrawals);
    } catch (error) {
        console.error("Partner: Get withdrawals error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerWithdrawalById = async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawal = await prisma.withdrawal.findUnique({
            where: { id, partnerId: req.user.id },
        });
        if (!withdrawal) {
            return res.status(404).json({ message: "Withdrawal not found or you don't have access to it." });
        }
        res.status(200).json(withdrawal);
    } catch (error) {
        console.error("Partner: Get withdrawal by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// --- Admin-specific Withdrawal Management Routes (Processed by Admin) ---

exports.getAllWithdrawalsForAdmin = async (req, res) => {
    try {
        const withdrawals = await prisma.withdrawal.findMany({
            include: {
                partner: { select: { id: true, email: true, contactName: true } },
            },
            orderBy: { requestedAt: 'desc' }
        });
        res.status(200).json(withdrawals);
    } catch (error) {
        console.error("Admin: Get all withdrawals error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getWithdrawalByIdForAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawal = await prisma.withdrawal.findUnique({
            where: { id },
            include: {
                partner: { select: { id: true, email: true, contactName: true } },
            },
        });
        if (!withdrawal) {
            return res.status(404).json({ message: "Withdrawal not found" });
        }
        res.status(200).json(withdrawal);
    } catch (error) {
        console.error("Admin: Get withdrawal by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.processWithdrawalByAdmin = async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELED', 'FAILED'].includes(status)) {
        return res.status(400).json({ message: "Invalid withdrawal status provided." });
    }

    try {
        const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
        if (!withdrawal) {
            return res.status(404).json({ message: "Withdrawal request not found." });
        }

        if (['COMPLETED', 'CANCELED', 'FAILED'].includes(withdrawal.status)) {
            return res.status(400).json({ message: `Withdrawal is already ${withdrawal.status}. Cannot process further.` });
        }

        const updateData = {
            status,
            note: note !== undefined ? note : withdrawal.note,
            processedAt: new Date(),
        };

        if (status === 'CANCELED' || status === 'FAILED') {
            if (withdrawal.status !== 'COMPLETED') { // Make sure funds were not already paid
                await prisma.partner.update({
                    where: { id: withdrawal.partnerId },
                    data: {
                        availableBalance: { // Ensure this matches your Partner model field name
                            increment: withdrawal.amount
                        }
                    }
                });
            }
        }

        const updatedWithdrawal = await prisma.withdrawal.update({
            where: { id },
            data: updateData,
        });

        res.status(200).json({ message: `Withdrawal request status updated to ${status.toLowerCase()}.`, withdrawal: updatedWithdrawal });
    } catch (error) {
        console.error("Admin: Process withdrawal error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Withdrawal or Partner not found." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteWithdrawalByAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
        if (!withdrawal) {
            return res.status(404).json({ message: "Withdrawal not found." });
        }

        if (withdrawal.status === 'PENDING' || withdrawal.status === 'PROCESSING') {
            await prisma.partner.update({
                where: { id: withdrawal.partnerId },
                data: {
                    availableBalance: { // Ensure this matches your Partner model field name
                        increment: withdrawal.amount
                    }
                }
            });
        }

        await prisma.withdrawal.delete({ where: { id } });
        res.status(204).send(); // No content for successful deletion
    } catch (error) {
        console.error("Admin: Delete withdrawal error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Withdrawal not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};