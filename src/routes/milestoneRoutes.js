// src/routes/milestoneRoutes.js
const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Admin-Specific Milestone Routes ---
// Admins have full CRUD control over milestones
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, milestoneController.createMilestoneByAdmin);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, milestoneController.getAllMilestonesForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, milestoneController.getMilestoneByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, milestoneController.updateMilestoneByAdmin); // General update
router.put('/:id/approve', authMiddleware.authenticate, roleMiddleware.isAdmin, milestoneController.approveMilestoneByAdmin); // Specific action for approval
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, milestoneController.deleteMilestoneByAdmin);

// --- Partner-Specific Milestone Routes ---
// Partners can view milestones assigned to their projects and update status
router.get('/partner', authMiddleware.authenticate, roleMiddleware.isPartner, milestoneController.getPartnerMilestones);
router.get('/partner/:id', authMiddleware.authenticate, roleMiddleware.isPartner, milestoneController.getPartnerMilestoneById);
router.put('/partner/:id/status', authMiddleware.authenticate, roleMiddleware.isPartner, milestoneController.updateMilestoneStatusByPartner);

// --- Client-Specific Milestone Routes ---
// Clients can view milestones related to their projects
router.get('/client', authMiddleware.authenticate, roleMiddleware.isClient, milestoneController.getClientMilestones);
router.get('/client/:id', authMiddleware.authenticate, roleMiddleware.isClient, milestoneController.getClientMilestoneById);

module.exports = router;