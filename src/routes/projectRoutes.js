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

// --- Admin-Specific Project Routes ---
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.createProject);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.getAllProjectsForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.getProjectByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.updateProjectByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, projectController.deleteProjectByAdmin);

// --- Client-Specific Project Routes ---

router.get('/client', authMiddleware.authenticate, roleMiddleware.isClient, projectController.getClientProjects);
router.get('/client/:id', authMiddleware.authenticate, roleMiddleware.isClient, projectController.getClientProjectById);
// Clients can't create/delete projects, only view them



module.exports = router;