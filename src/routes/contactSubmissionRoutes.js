// src/routes/contactSubmissionRoutes.js
const express = require('express');
const router = express.Router();
const contactSubmissionController = require('../controllers/contactSubmissionController');
const authMiddleware = require('../middlewares/authMiddleware'); // Used for admin routes
const roleMiddleware = require('../middlewares/roleMiddleware'); // Used for admin routes

// --- Public Route for Contact Form Submission ---
router.post('/', contactSubmissionController.submitContactForm);

// --- Admin-Specific Contact Submission Management Routes ---
// All routes below this require authentication and the 'admin' role
router.get('/',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    contactSubmissionController.getAllContactSubmissionsForAdmin
);
router.get('/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    contactSubmissionController.getContactSubmissionByIdForAdmin
);
router.put('/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    contactSubmissionController.updateContactSubmissionByAdmin
);
router.delete('/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    contactSubmissionController.deleteContactSubmissionByAdmin
);

module.exports = router;