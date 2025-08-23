// src/routes/paymentAndFinanceRoutes.js
const express = require('express');
const router = express.Router();
const paymentAndFinanceController = require('../controllers/paymentAndFinanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Route for a client to process a milestone payment
router.post(
    '/process-milestone-payment',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    paymentAndFinanceController.processMilestonePayment
);

// Admin-facing routes for financial reporting
router.get(
    '/summary/revenue',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    paymentAndFinanceController.getRevenueSummary
);

router.get(
    '/summary/gst',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    paymentAndFinanceController.getGstSummary
);

router.get(
    '/partner/:id/earnings',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    paymentAndFinanceController.getPartnerEarnings
);

module.exports = router;