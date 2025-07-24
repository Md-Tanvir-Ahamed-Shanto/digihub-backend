// src/routes/solutionRoutes.js
const express = require('express');
const router = express.Router();
const solutionController = require('../controllers/solutionController');
const authMiddleware = require('../middlewares/authMiddleware'); // Assuming for admin routes
const roleMiddleware = require('../middlewares/roleMiddleware'); // Assuming for admin routes

// Public routes (e.g., for displaying solutions on the frontend)
router.get('/', solutionController.getAllSolutions);
router.get('/:id', solutionController.getSolutionById);

// Admin-only routes (requires authentication and admin role)
router.post(
  '/',
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  solutionController.createSolution
);
router.put(
  '/:id',
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  solutionController.updateSolution
);
router.delete(
  '/:id',
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  solutionController.deleteSolution
);

module.exports = router;