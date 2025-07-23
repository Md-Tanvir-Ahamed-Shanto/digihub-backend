// src/routes/gstReportRoutes.js
const express = require('express');
const router = express.Router();
const gstReportController = require('../controllers/gstReportController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// All GST report routes require admin access
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, gstReportController.createGstReport);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, gstReportController.getAllGstReports);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, gstReportController.getGstReportById);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, gstReportController.updateGstReport);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, gstReportController.deleteGstReport);

module.exports = router;