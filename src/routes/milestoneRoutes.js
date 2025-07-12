const express = require("express");
const router = express.Router();
const milestoneController = require("../controllers/milestoneController"); // Adjust path
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

// -------------------- Partner Routes --------------------
// Partner creates milestones for a project
router.post(
  "/partner/projects/:projectId/milestones",
  authMiddleware.authenticate,
  roleMiddleware.isPartner,
  milestoneController.createMilestones
);
// Partner views their project's milestones
router.get(
  "/partner/projects/:projectId/milestones",
  authMiddleware.authenticate,
  roleMiddleware.isPartner,
  milestoneController.getPartnerMilestonesByProject
);
// Partner updates a specific milestone (e.g., to correct details before admin review)
router.put(
  "/partner/milestones/:milestoneId",
  authMiddleware.authenticate,
  roleMiddleware.isPartner,
  milestoneController.updatePartnerMilestone
);

// -------------------- Admin Routes --------------------
// Admin views all milestones for a project
router.get(
  "/admin/projects/:projectId/milestones",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  milestoneController.getAdminMilestonesByProject
);
// Admin approves a milestone
router.put(
  "/admin/milestones/:milestoneId/approve",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  milestoneController.approveMilestone
);
// Admin rejects a milestone
router.put(
  "/admin/milestones/:milestoneId/reject",
  authMiddleware.authenticate,
  roleMiddleware.isAdmin,
  milestoneController.rejectMilestone
);

// -------------------- Client Routes --------------------
// Client views their project's milestones (only approved/active ones)
router.get(
  "/client/projects/:projectId/milestones",
  authMiddleware.authenticate,
  roleMiddleware.isClient,
  milestoneController.getClientMilestonesByProject
);

// -------------------- Common Routes (for specific milestone details) --------------------
// Get details of a single milestone (accessible by relevant Client, Partner, Admin)
// The controller will handle authorization based on role and project/milestone ownership
router.get(
    "/milestones/:milestoneId",
    authMiddleware.authenticate,
  milestoneController.getMilestoneDetails
);

module.exports = router;
