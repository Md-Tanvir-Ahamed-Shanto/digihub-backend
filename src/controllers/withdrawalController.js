// src/controllers/withdrawalController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

// --- Partner-specific Withdrawal Routes (Initiated by Partner) ---
// Note: This endpoint was already provided in partnerController, but can be here for consistency.
// I'll make it explicit here for the withdrawal model's dedicated file.

exports.requestWithdrawal = async (req, res) => {
    const { amount, note } = req.body;
    if (!amount || new Decimal(amount).lessThanOrEqualTo(0)) {
        return res.status(400).json({ message: "A valid amount is required for withdrawal." });
    }

    try {
        const partner = await prisma.partner.findUnique({
            where: { id: req.user.id },
            select: { availableBalance: true }
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
            }
        });

        // Deduct from available balance immediately upon request
        await prisma.partner.update({
            where: { id: req.user.id },
            data: {
                availableBalance: {
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
                partner: { select: { id: true, name: true, email: true } },
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
                partner: { select: { id: true, name: true, email: true } },
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
    const { status, note } = req.body; // Status can be APPROVED, PAID, REJECTED

    if (!['APPROVED', 'PAID', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: "Invalid withdrawal status provided." });
    }

    try {
        const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
        if (!withdrawal) {
            return res.status(404).json({ message: "Withdrawal request not found." });
        }

        // Prevent processing an already paid/rejected request unless specifically allowed
        if (withdrawal.status === 'PAID' || withdrawal.status === 'REJECTED') {
            return res.status(400).json({ message: `Withdrawal is already ${withdrawal.status}. Cannot process further.` });
        }

        const updateData = {
            status,
            note: note || withdrawal.note, // Allow admin to add/update note
            processedAt: new Date(),
        };

        if (status === 'REJECTED') {
            // If rejected, return the amount to the partner's available balance
            await prisma.partner.update({
                where: { id: withdrawal.partnerId },
                data: {
                    availableBalance: {
                        increment: withdrawal.amount
                    }
                }
            });
        }
        // If status is 'PAID', the amount was already decremented on request.

        const updatedWithdrawal = await prisma.withdrawal.update({
            where: { id },
            data: updateData,
        });

        res.status(200).json({ message: `Withdrawal request ${status.toLowerCase()} successfully.`, withdrawal: updatedWithdrawal });
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

        // If a withdrawal was PENDING or APPROVED and is now being deleted by admin,
        // you might want to return the amount to the partner's balance.
        // If it was already PAID, deleting it won't revert the payment.
        if (withdrawal.status === 'PENDING' || withdrawal.status === 'APPROVED') {
             await prisma.partner.update({
                where: { id: withdrawal.partnerId },
                data: {
                    availableBalance: {
                        increment: withdrawal.amount
                    }
                }
             });
        }

        await prisma.withdrawal.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Delete withdrawal error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Withdrawal not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};