const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Partner-Specific Project Routes ---
// Partners can only see and manage projects assigned to them
router.get('/partner', authMiddleware.authenticate, roleMiddleware.isPartner, projectController.getPartnerProjects);
router.get('/partner/:id', authMiddleware.authenticate, roleMiddleware.isPartner, projectController.getPartnerProjectById);
router.put('/partner/:id', authMiddleware.authenticate, roleMiddleware.isPartner, projectController.updateProjectByPartner);

router.get('/client', authMiddleware.authenticate, roleMiddleware.isClient, projectController.getClientProjects);
// router.get('/client/:id', authMiddleware.authenticate, roleMiddleware.isClient, projectController.getClientProjectById);
router.get('/client/:id', authMiddleware.authenticate, projectController.getClientAllProjects);

// --- Admin-Specific Project Routes ---
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.createProject);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.getAllProjectsForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.getProjectByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.updateProjectByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.deleteProjectByAdmin);
router.put('/:id/complete', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.markAsComplete);

// --- Client-Specific Project Routes ---





module.exports = router;