// src/routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Client-Specific Support Ticket Routes ---
router.post('/client/tickets',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    supportController.createSupportTicketByClient
);
router.get('/client/tickets',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    supportController.getClientSupportTickets
);
router.get('/client/tickets/:id',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    supportController.getClientSupportTicketById
);
router.post('/client/tickets/:id/responses',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    supportController.addResponseByClient
);

// --- Partner-Specific Support Ticket Routes ---
router.get('/partner/tickets',
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    supportController.getPartnerAssignedTickets
);
router.get('/partner/tickets/:id',
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    supportController.getPartnerSupportTicketById
);
router.put('/partner/tickets/:id', // Partner can update status/priority
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    supportController.updateSupportTicketByPartner
);
router.post('/partner/tickets/:id/responses',
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    supportController.addResponseByPartner
);


// --- Admin-Specific Support Ticket Routes ---
router.post('/admin/tickets',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.createSupportTicketByAdmin
);
router.get('/admin/tickets',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.getAllSupportTicketsForAdmin
);
router.get('/admin/tickets/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.getSupportTicketByIdForAdmin
);
router.put('/admin/tickets/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.updateSupportTicketByAdmin
);
router.delete('/admin/tickets/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.deleteSupportTicketByAdmin
);
router.post('/admin/tickets/:id/responses', // Admin adds a response
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.addResponseByAdmin
);
router.get('/admin/tickets/:id/responses', // Admin views all responses for a ticket
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    supportController.getTicketResponsesForAdmin
);

module.exports = router;