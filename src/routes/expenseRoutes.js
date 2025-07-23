// src/routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// All expense routes require admin access
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, expenseController.createExpense);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, expenseController.getAllExpenses);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, expenseController.getExpenseById);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, expenseController.updateExpense);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, expenseController.deleteExpense);

module.exports = router;