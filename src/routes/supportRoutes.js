// src/routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {
  createIssue,
  getClientIssues,
  clientReplyToIssue,
  getPartnerIssues,
  partnerReplyToIssue,
  closeIssue,
  getAllIssues,
  changeStatus,
  deleteIssue,
  assignToPartner
} = require('../controllers/supportController');

// Client routes
router.post('/issues',authMiddleware.authenticate, createIssue);                      // Client creates issue
router.get('/client/:clientId/issues',authMiddleware.authenticate, getClientIssues);  // Client views their issues
router.post('/client/issues/:ticketId/reply',authMiddleware.authenticate, clientReplyToIssue); // Client replies

// Partner routes  
router.get('/partner/:partnerId/issues',authMiddleware.authenticate, getPartnerIssues);        // Partner views assigned issues
router.post('/partner/issues/:ticketId/reply',authMiddleware.authenticate, partnerReplyToIssue); // Partner replies
router.put('/partner/issues/:id/close',authMiddleware.authenticate, closeIssue);                       // Partner closes issue

// Admin routes
router.get('/admin/issues',authMiddleware.authenticate, getAllIssues);              // Admin sees all issues
router.put('/admin/issues/:id/status',authMiddleware.authenticate, changeStatus);   // Admin changes status
router.delete('/admin/issues/:id',authMiddleware.authenticate, deleteIssue);        // Admin deletes issue
router.put('/admin/issues/:id/assign',authMiddleware.authenticate, assignToPartner); // Admin assigns to partner

module.exports = router;