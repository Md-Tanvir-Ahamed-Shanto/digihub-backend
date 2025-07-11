const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

// --- Public Route ---
router.post("/submit", leadController.submitLead);
// --- Admin Routes ---
// Get all leads (project quotes) for admin review
router.get(
  "/",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  leadController.getAllLeads
);

// Get a single lead by ID for admin review
router.get(
  "/:id",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  leadController.getLeadById
);

// Admin assigns a partner to a lead
router.put(
  "/:id/assign-partner",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  leadController.assignPartnerToLead
);


// Admin manually updates a lead's general information (excluding offer details handled separately)
// This includes basic updates like name, description, etc., and potentially status.
router.put(
  "/:id",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  leadController.updateLeadByAdmin
);

// Admin updates only the status of a lead
router.put(
  "/:id/status",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  leadController.updateLeadStatus
);

// Admin deletes a lead
router.delete(
  "/:id",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  leadController.deleteLeadByAdmin
);

// --- Client Routes ---
router.post('/:leadId/send-offer-to-client',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    leadController.sendOfferToClient
);

// --- Client-facing Lead/Offer Routes ---
router.post('/:id/accept-offer',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    leadController.clientAcceptOffer
);

router.post('/:leadId/reject-offer',
    authMiddleware.authenticate,
    roleMiddleware.isClient,
    leadController.clientRejectsOffer
);


module.exports = router;
