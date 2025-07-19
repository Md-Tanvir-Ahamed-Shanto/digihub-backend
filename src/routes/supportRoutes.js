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
router.post('/issues', createIssue);                      // Client creates issue
router.get('/client/:clientId/issues', getClientIssues);  // Client views their issues
router.post('/client/issues/:ticketId/reply', clientReplyToIssue); // Client replies

// Partner routes  
router.get('/partner/:partnerId/issues', getPartnerIssues);        // Partner views assigned issues
router.post('/partner/issues/:ticketId/reply', partnerReplyToIssue); // Partner replies
router.put('/issues/:id/close', closeIssue);                       // Partner closes issue

// Admin routes
router.get('/admin/issues', getAllIssues);              // Admin sees all issues
router.put('/admin/issues/:id/status', changeStatus);   // Admin changes status
router.delete('/admin/issues/:id', deleteIssue);        // Admin deletes issue
router.put('/admin/issues/:id/assign', assignToPartner); // Admin assigns to partner

module.exports = router;