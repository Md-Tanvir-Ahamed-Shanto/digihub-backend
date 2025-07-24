// src/routes/caseStudyRoutes.js
const express = require('express');
const router = express.Router();
const caseStudyController = require('../controllers/caseStudyController');
const authMiddleware = require('../middlewares/authMiddleware'); // Assuming for admin routes
const roleMiddleware = require('../middlewares/roleMiddleware'); // Assuming for admin routes

// Public routes (e.g., for displaying case studies on the frontend)
router.get('/', caseStudyController.getAllCaseStudies);
router.get('/:id', caseStudyController.getCaseStudyById);

// Admin-only routes (requires authentication and admin role)
// Note: For routes with file uploads, ensure you're sending `Content-Type: multipart/form-data`
router.post(
  '/',
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  caseStudyController.createCaseStudy
);
router.put(
  '/:id',
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  caseStudyController.updateCaseStudy
);
router.delete(
  '/:id',
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  caseStudyController.deleteCaseStudy
);

module.exports = router;