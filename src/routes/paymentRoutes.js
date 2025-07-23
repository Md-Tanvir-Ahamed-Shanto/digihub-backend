// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Middleware to handle raw body for Stripe webhooks
// IMPORTANT: This must come BEFORE express.json() for other routes in your main app.js/server.js
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.stripeWebhook);

// Client-facing payment intent creation for PROJECTS/INVOICES (existing)
router.post('/create-project-payment-intent', authMiddleware.authenticate, roleMiddleware.isClient, paymentController.createPaymentIntent);

// NEW: Client-facing payment intent creation for MAINTENANCE SUBSCRIPTIONS
router.post('/create-subscription-payment-intent', authMiddleware.authenticate, roleMiddleware.isClient, paymentController.createSubscriptionPaymentIntent);

// Admin-facing payment management
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.getAllPaymentsForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.getPaymentByIdForAdmin);
router.put('/:id/status', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.updatePaymentStatusByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, paymentController.deletePaymentByAdmin);

module.exports = router;