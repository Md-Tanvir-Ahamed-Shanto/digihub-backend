// src/controllers/expenseController.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const Decimal = require('decimal.js'); // For precise decimal handling

// --- Admin-specific Expense Management Routes ---

exports.createExpense = async (req, res) => {
    const {description, amount, category, date } = req.body;

    if ( amount === undefined || !category) {
        return res.status(400).json({ message: "amount, category, are required." });
    }
    if (new Decimal(amount).lessThanOrEqualTo(0)) {
        return res.status(400).json({ message: "Amount must be a positive number." });
    }

    try {
        const newExpense = await prisma.expense.create({
            data: {
                description,
                amount: new Decimal(amount),
                category,
                date: date ? new Date(date) : new Date(),
            },
        });
        res.status(201).json({ message: "Expense created successfully", expense: newExpense });
    } catch (error) {
        console.error("Create expense error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllExpenses = async (req, res) => {
    try {
        const expenses = await prisma.expense.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(expenses);
    } catch (error) {
        console.error("Get all expenses error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getExpenseById = async (req, res) => {
    const { id } = req.params;
    try {
        const expense = await prisma.expense.findUnique({
            where: { id },
        });
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }
        res.status(200).json(expense);
    } catch (error) {
        console.error("Get expense by ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateExpense = async (req, res) => {
    const { id } = req.params;
    const { title, description, amount, category, date } = req.body;

    try {
        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description; // Allow null to clear
        if (amount !== undefined) {
            const decimalAmount = new Decimal(amount);
            if (decimalAmount.lessThanOrEqualTo(0)) {
                return res.status(400).json({ message: "Amount must be a positive number." });
            }
            updateData.amount = decimalAmount;
        }
        if (category) updateData.category = category;
        if (date) updateData.date = new Date(date);

        const updatedExpense = await prisma.expense.update({
            where: { id },
            data: updateData,
        });
        res.status(200).json({ message: "Expense updated successfully", expense: updatedExpense });
    } catch (error) {
        console.error("Update expense error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Expense not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteExpense = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.expense.delete({ where: { id } });
        res.status(204).send(); // No content
    } catch (error) {
        console.error("Delete expense error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Expense not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};