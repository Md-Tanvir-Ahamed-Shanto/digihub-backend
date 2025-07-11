// src/routes/maintenanceRoutes.js
const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Maintenance Plan Routes (Admin Only) ---
router.post('/plans',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceController.createMaintenancePlan
);
router.get('/plans',
    authMiddleware.authenticate,
    maintenanceController.getAllMaintenancePlans // Accessible by Admin (all) and Client (active ones to choose from)
);
router.put('/plans/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceController.updateMaintenancePlan
);
router.delete('/plans/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceController.deleteMaintenancePlan
);

// --- Maintenance Subscription Routes ---

// Admin: Create/Assign a subscription for a client
router.post('/subscriptions/admin',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceController.createSubscriptionByAdmin
);

// Client: Subscribe to a plan
router.post('/subscriptions/client',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    maintenanceController.subscribeToPlanByClient
);

// Get all subscriptions (Admin) or client's subscriptions (Client)
router.get('/subscriptions',
    authMiddleware.authenticate,
    maintenanceController.getSubscriptions
);

// Get a single subscription by ID (Admin or client's own)
router.get('/subscriptions/:id',
    authMiddleware.authenticate,
    maintenanceController.getSubscriptionById
);

// Update a subscription (Admin or client's own for cancellation/auto-renew toggle)
router.put('/subscriptions/:id',
    authMiddleware.authenticate,
    maintenanceController.updateSubscription
);

// Admin: Delete a subscription (force delete)
router.delete('/subscriptions/admin/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    maintenanceController.deleteSubscriptionByAdmin
);


module.exports = router;