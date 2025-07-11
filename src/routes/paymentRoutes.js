// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Admin-Specific Payment Routes ---
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.createPaymentByAdmin);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.getAllPaymentsForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.getPaymentByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.updatePaymentByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.deletePaymentByAdmin);

// --- Client-Specific Payment Routes ---
router.get('/client', authMiddleware.authenticate, roleMiddleware.isClient, paymentController.getClientPayments);
router.get('/client/:id', authMiddleware.authenticate, roleMiddleware.isClient, paymentController.getClientPaymentById);
router.post('/client/initiate', authMiddleware.authenticate, roleMiddleware.isClient, paymentController.initiatePayment);

module.exports = router;