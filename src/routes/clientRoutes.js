const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Public routes (no authentication needed for these initial steps)
router.post('/register', clientController.registerClient);
router.post('/login', clientController.clientLogin);
router.post('/set-password', clientController.setClientPasswordAndActivate);

// Client-specific routes (require authentication as a client)
router.get('/profile', authMiddleware.authenticate, roleMiddleware.isClient, clientController.getClientProfile);
router.put('/profile', authMiddleware.authenticate, roleMiddleware.isClient, clientController.updateClientProfile);
router.get('/my-leads', authMiddleware.authenticate, roleMiddleware.isClient, clientController.getClientLeads);
router.post("/update-credentials", authMiddleware.authenticate, roleMiddleware.isClient, clientController.updateCredentials);

// Admin-specific client management routes (require authentication as an admin)
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.getAllClientsForAdmin);
// NEW ROUTE: Get all clients that have a maintenance subscription
router.get('/maintenance-subscriptions', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.getAllClientsWithMaintenanceSubscription);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.getClientByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.updateClientByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.deleteClientByAdmin);


module.exports = router;