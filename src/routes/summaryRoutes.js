// src/routes/summaryRoutes.js
const express = require('express');
const router = express.Router();
const summaryController = require('../controllers/summaryController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// All summary routes require admin access
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, summaryController.createSummary);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, summaryController.getAllSummaries);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, summaryController.getSummaryById);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, summaryController.updateSummary);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, summaryController.deleteSummary);

module.exports = router;