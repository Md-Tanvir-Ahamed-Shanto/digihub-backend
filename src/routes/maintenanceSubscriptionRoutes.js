// src/routes/maintenanceSubscriptionRoutes.js
const express = require('express');
const router = express.Router();
const maintenanceSubscriptionController = require('../controllers/maintenanceSubscriptionController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Client-facing routes ---
/**
 * @route GET /api/subscriptions/my
 * @desc Get the authenticated client's own maintenance subscription details
 * @access Private (Client only)
 */
router.get(
    '/my',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    maintenanceSubscriptionController.getMyMaintenanceSubscription
);

// --- Admin-facing routes ---
/**
 * @route GET /api/subscriptions
 * @desc Admin: Get all maintenance subscriptions
 * @access Private (Admin only)
 */
router.get(
    '/',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceSubscriptionController.getAllSubscriptionsForAdmin
);

/**
 * @route GET /api/subscriptions/:id
 * @desc Admin: Get a single maintenance subscription by ID
 * @access Private (Admin only)
 */
router.get(
    '/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceSubscriptionController.getSubscriptionByIdForAdmin
);

/**
 * @route POST /api/subscriptions
 * @desc Admin: Create a new maintenance subscription
 * @access Private (Admin only)
 */
router.post(
    '/',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceSubscriptionController.createSubscriptionByAdmin
);

/**
 * @route PUT /api/subscriptions/:id
 * @desc Admin: Update a maintenance subscription
 * @access Private (Admin only)
 */
router.put(
    '/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceSubscriptionController.updateSubscriptionByAdmin
);

/**
 * @route DELETE /api/subscriptions/:id
 * @desc Admin: Delete a maintenance subscription
 * @access Private (Admin only)
 */
router.delete(
    '/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceSubscriptionController.deleteSubscriptionByAdmin
);

module.exports = router;