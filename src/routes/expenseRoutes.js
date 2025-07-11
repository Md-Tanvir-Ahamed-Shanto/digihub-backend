// src/routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// All expense routes require authentication and the 'admin' role
router.use(authMiddleware.authenticate);
router.use(roleMiddleware.isAdmin);

// Create a new expense
router.post('/', expenseController.createExpense);

// Get all expenses
router.get('/', expenseController.getAllExpenses);

// Get a single expense by ID
router.get('/:id', expenseController.getExpenseById);

// Update an expense by ID
router.put('/:id', expenseController.updateExpense);

// Delete an expense by ID
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;