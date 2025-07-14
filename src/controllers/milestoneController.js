const { PrismaClient } = require("../generated/prisma");
const emailService = require("../utils/emailService"); // Adjust path as needed
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080"; // Make sure this is defined
const { Decimal } = require("@prisma/client"); // Import Decimal for calculations
const prisma = new PrismaClient();
// Helper function to calculate client cost for a milestone
// You might have a global admin margin, or it might be per project.
// For simplicity, let's assume a global margin or derived from project's adminMargin
const calculateClientMilestoneCost = (
  partnerCost,
  projectAdminMarginPercentage,
  projectIncludesGST
) => {
  // Convert Decimal to number for calculation, then convert back
  const partnerCostNum = partnerCost.toNumber();
  const adminMarginFactor = 1 + projectAdminMarginPercentage.toNumber() / 100; // e.g., 20% margin -> 1.20
  let clientCostBeforeGST = partnerCostNum * adminMarginFactor;

  if (projectIncludesGST) {
    // Assuming GST is 10% or from a config
    const GST_RATE = 0.1; // Or from a config/env variable
    clientCostBeforeGST *= 1 + GST_RATE;
  }
  return new Decimal(clientCostBeforeGST);
};

// --------------------------------------------------------
// Partner Functions
// --------------------------------------------------------

/**
 * @desc Partner submits one or more milestones for a specific project
 * @route POST /api/partner/projects/:projectId/milestones
 * @access Private/Partner
 */
exports.createMilestones = async (req, res) => {
  try {
    const partnerId = req.user.id; // Authenticated partner ID
    const { projectId } = req.params;
    const milestonesData = req.body;

    if (!Array.isArray(milestonesData) || milestonesData.length === 0) {
      console.log(
        "3. Validation Error: Milestone data is empty or not an array."
      );
      return res.status(400).json({
        success: false,
        message: "Milestone data must be a non-empty array.",
      });
    }

    // Fetch the project to validate ownership and get admin ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        partnerId: true,
        createdByAdminId: true,
        title: true,
      }, // Added title for better logs
    });

    // This is the check that should prevent the error if project is null/undefined
    if (!project) {
      console.log("6. Error: Project not found in DB for ID:", projectId);
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    }

    // This check validates ownership
    if (project.partnerId !== partnerId) {
      console.log(
        "7. Error: Access denied for partner. Project ID:",
        projectId,
        "Partner ID:",
        partnerId
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not assigned to this project.",
      });
    }

    const createdMilestones = [];
    let orderCounter = 1;

    for (const mData of milestonesData) {
      if (!mData.title || !mData.cost || !mData.timeline) {
        console.log(
          "9. Validation Error: Missing title, cost, or timeline in a milestone object:",
          mData
        );
        return res.status(400).json({
          success: false,
          message: "Each milestone must have a title, cost, and timeline.",
        });
      }

      const costDecimal = new Decimal(mData.cost);
      if (costDecimal.isNegative() || costDecimal.isZero()) {
        console.log(
          "10. Validation Error: Milestone cost is not positive:",
          mData.cost
        );
        return res.status(400).json({
          success: false,
          message: "Milestone cost must be a positive number.",
        });
      }

      const created = await prisma.milestone.create({
        data: {
          title: mData.title,
          cost: costDecimal,
          duration: parseInt(mData.timeline),
          description: mData.description || null,
          order: orderCounter++,
          projectId: projectId,
          partnerId: partnerId,
          status: "PENDING",
        },
      });
      createdMilestones.push(created);
    }

    // Notify Admin about new milestones awaiting review
    // This is the section where the error was pointing (line 44 in your original traceback)
    const admin = await prisma.admin.findUnique({
      where: { id: project.createdByAdminId }, // This line should be safe now if 'project' is valid
      select: { name: true, email: true },
    });

    if (admin && admin.email) {
      await emailService.sendEmail({
        to: admin.email,
        subject: `New Milestones Submitted for Project "${
          project.title || project.id
        }"`, // Use title if available
        html: `
                    <p>Dear ${admin.name},</p>
                    <p>New milestones have been submitted by the partner for project <strong>"${
                      project.title || project.id
                    }"</strong>. They are awaiting your review and approval.</p>
                    <p>Milestone Details: ${createdMilestones
                      .map(
                        (m) =>
                          `<li>${m.title} - Cost: $${m.cost.toFixed(2)}</li>`
                      )
                      .join("")}</p>
                    <p>Review here: <a href="${FRONTEND_URL}/admin/projects/${projectId}/milestones">Review Milestones</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `,
      });
    } else {
    }

    res.status(201).json({
      success: true,
      message: "Milestones submitted successfully for admin review.",
      milestones: createdMilestones,
    });
    console.log("13. Response sent: Milestones created successfully.");
  } catch (error) {
    console.error("Error creating milestones:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc Partner updates a pending milestone
 * @route PUT /api/partner/milestones/:milestoneId
 * @access Private/Partner
 */
exports.updatePartnerMilestone = async (req, res) => {
  try {
    const partnerId = req.user.id;
    const { milestoneId } = req.params;
    const { title, cost, timeline, description } = req.body;

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, partnerId: true, status: true, projectId: true },
    });

    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found." });
    }
    if (milestone.partnerId !== partnerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not the partner for this milestone.",
      });
    }
    if (milestone.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending milestones can be updated by partner.",
      });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (cost !== undefined) {
      const costDecimal = new Decimal(cost);
      if (costDecimal.isNegative() || costDecimal.isZero()) {
        return res.status(400).json({
          success: false,
          message: "Milestone cost must be a positive number.",
        });
      }
      updateData.cost = costDecimal;
    }
    if (timeline !== undefined) updateData.duration = parseInt(timeline);
    if (description !== undefined) updateData.description = description;

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: "Milestone updated successfully.",
      milestone: updated,
    });
  } catch (error) {
    console.error("Error updating partner milestone:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc Partner views all milestones for their assigned project
 * @route GET /api/partner/projects/:projectId/milestones
 * @access Private/Partner
 */
exports.getPartnerMilestonesByProject = async (req, res) => {
  try {
    const partnerId = req.user.id;
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, partnerId: true },
    });

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    }
    if (project.partnerId !== partnerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not assigned to this project.",
      });
    }

    const milestones = await prisma.milestone.findMany({
      where: { projectId: projectId },
      orderBy: { order: "asc" },
    });

    res.status(200).json({ success: true, milestones });
  } catch (error) {
    console.error("Error fetching partner milestones:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// --------------------------------------------------------
// Admin Functions
// --------------------------------------------------------

/**
 * @desc Admin views all milestones for a project (including pending ones)
 * @route GET /api/admin/projects/:projectId/milestones
 * @access Private/Admin
 */
exports.getAdminMilestonesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Optionally, check if admin is associated with this project (e.g., createdByAdminId)
    // For simplicity, any admin can view all milestones for any project here.
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    }

    const milestones = await prisma.milestone.findMany({
      where: { projectId: projectId },
      orderBy: { order: "asc" },
      include: { partner: { select: { id: true, name: true, email: true } } }, // Include partner details
    });

    res.status(200).json({ success: true, milestones });
  } catch (error) {
    console.error("Error fetching admin milestones:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc Admin approves a partner-submitted milestone, sets client cost, timeline, and generates an invoice.
 * @route PUT /api/admin/milestones/:milestoneId/approve
 * @access Private/Admin
 */
exports.approveMilestone = async (req, res) => {
  try {
    const adminId = req.user.id; // Authenticated admin ID
    const { milestoneId } = req.params;
    const { clientCost, estimatedTimeline, additionalNotes, includesGST } =
      req.body; // clientCost is required here

    if (clientCost === undefined || !estimatedTimeline) {
      return res.status(400).json({
        success: false,
        message:
          "Client cost and estimated timeline are required for approval.",
      });
    }

    const clientCostDecimal = new Decimal(clientCost);
    if (clientCostDecimal.isNegative() || clientCostDecimal.isZero()) {
      return res.status(400).json({
        success: false,
        message: "Client cost must be a positive number.",
      });
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          select: {
            id: true,
            clientId: true,
            client: { select: { id: true, name: true, email: true } },
            partner: { select: { id: true, name: true, email: true } },
            offerPrice: true, // Total project offer price for reference
            adminMargin: true, // For calculations if needed, though clientCost is provided
            includesGST: true, // Original project GST setting
          },
        },
        partner: { select: { id: true, name: true, email: true } }, // Original partner of the milestone
      },
    });

    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found." });
    }
    if (milestone.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Milestone cannot be approved. Current status is "${milestone.status}".`,
      });
    }

    // Calculate GST amount for the invoice
    let gstAmount = new Decimal(0);
    let finalInvoiceTotal = clientCostDecimal;
    const GST_RATE_DECIMAL = new Decimal("0.10"); // Assuming 10% GST, adjust as per your constant

    const applyGST =
      includesGST !== undefined
        ? includesGST
        : milestone.project.includesGST || false; // Use provided includesGST or project's default

    if (applyGST) {
      gstAmount = clientCostDecimal.times(GST_RATE_DECIMAL);
      finalInvoiceTotal = clientCostDecimal.plus(gstAmount);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Milestone Status and add Admin-specific details
      const updatedMilestone = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status: "APPROVED", // Now approved by admin
          clientCost: clientCostDecimal, // Add this field to your Milestone schema
          estimatedTimeline: estimatedTimeline, // Add this field to your Milestone schema (e.g., String or Int)
          additionalNotes: additionalNotes || null, // Add this field to your Milestone schema (String?)
          approvedBy: { connect: { id: adminId } },
          includesGSTForInvoice: applyGST, // Add this to milestone schema if different from project-level
        },
      });

      // 2. Create an Invoice for the client
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: `INV-${Date.now()}-${milestone.project.clientId.substring(
            0,
            4
          )}`, // Generate unique invoice number
          amount: clientCostDecimal,
          gstAmount: gstAmount,
          totalAmount: finalInvoiceTotal,
          gstEnabled: applyGST,
          status: "PENDING", // Waiting for client payment
          dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Due in 7 days
          clientId: milestone.project.clientId,
          projectId: milestone.projectId,
          milestoneId: milestone.id,
        },
      });

      return { updatedMilestone, invoice };
    });

    // ⭐⭐⭐ Send Email Notifications OUTSIDE the transaction ⭐⭐⭐

    // Notify Client about the approved milestone and invoice
    if (milestone.project.client && milestone.project.client.email) {
      await emailService.sendEmail({
        to: milestone.project.client.email,
        subject: `Milestone Approved & Invoice Generated for Project: "${milestone.project.title}"`,
        html: `
                    <p>Dear ${milestone.project.client.name},</p>
<p>We're pleased to inform you that your milestone: <strong>"${
          milestone.title
        }"</strong> for project <strong>"${
          milestone.project.title
        }"</strong> has been approved and is ready to proceed.</p>
<p>An invoice (No: ${
          result.invoice.invoiceNumber
        }) totaling <strong>$${result.invoice.totalAmount.toFixed(
          2
        )}</strong> has been generated for this milestone. It's due by ${result.invoice.dueDate.toDateString()}.</p>
<p>To enable us to move forward and **officially begin work on this phase of your project**, please complete the payment via the link below:</p>
<p><a href="${FRONTEND_URL}/client/projects/${milestone.projectId}/milestones/${
          milestone.id
        }/invoice/${result.invoice.id}">Pay Invoice & Start Milestone</a></p>
<p>We look forward to making progress!</p>
<p>Sincerely,</p>
<p>DIGIHUB AUST System</p>
                `,
      });
    }

    // Notify Partner that their milestone has been approved by admin
    if (milestone.partner && milestone.partner.email) {
      await emailService.sendEmail({
        to: milestone.partner.email,
        subject: `Milestone Approved by Admin for Project: "${milestone.project.title}"`,
        html: `
                    <p>Dear ${milestone.partner.name},</p>
                    <p>Your submitted milestone <strong>"${milestone.title}"</strong> for project <strong>"${milestone.project.title}"</strong> has been approved by the admin.</p>
                    <p>You will be notified once the client completes the payment for this milestone.</p>
                    <p>View Milestone: <a href="${FRONTEND_URL}/partner/projects/${milestone.projectId}/milestones">View Milestone</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `,
      });
    }

    res.status(200).json({
      success: true,
      message: "Milestone approved and invoice created successfully.",
      milestone: result.updatedMilestone,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error("Error approving milestone:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc Admin rejects a partner-submitted milestone
 * @route PUT /api/admin/milestones/:milestoneId/reject
 * @access Private/Admin
 */
exports.rejectMilestone = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { milestoneId } = req.params;
    const { reason } = req.body; // Optional rejection reason

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            partnerId: true,
            partner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found." });
    }
    if (milestone.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Milestone cannot be rejected. Current status is "${milestone.status}".`,
      });
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: "REJECTED",
        adminId: adminId, // Record which admin rejected it
        // You might add a 'rejectionReason' field to Milestone model as well
        // rejectionReason: reason || null,
      },
    });

    // Notify Partner about the rejected milestone
    if (milestone.project.partner && milestone.project.partner.email) {
      await emailService.sendEmail({
        to: milestone.project.partner.email,
        subject: `Milestone Rejected for Project: "${milestone.project.title}"`,
        html: `
                    <p>Dear ${milestone.project.partner.name},</p>
                    <p>Your submitted milestone <strong>"${
                      milestone.title
                    }"</strong> for project <strong>"${
          milestone.project.title
        }"</strong> has been rejected by the admin.</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                    <p>Please review and resubmit if necessary.</p>
                    <p>View Milestone: <a href="${FRONTEND_URL}/partner/projects/${
          milestone.projectId
        }/milestones">View Milestone</a></p>
                    <p>Regards,</p>
                    <p>DIGIHUB AUST System</p>
                `,
      });
    }

    res.status(200).json({
      success: true,
      message: "Milestone rejected successfully.",
      milestone: updatedMilestone,
    });
  } catch (error) {
    console.error("Error rejecting milestone:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// --------------------------------------------------------
// Client Functions
// --------------------------------------------------------

/**
 * @desc Client views all APPROVED milestones for their project
 * @route GET /api/client/projects/:projectId/milestones
 * @access Private/Client
 */
exports.getClientMilestonesByProject = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true },
    });

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    }
    if (project.clientId !== clientId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not the client for this project.",
      });
    }

    const milestones = await prisma.milestone.findMany({
      where: {
        projectId: projectId,
        status: {
          in: ["APPROVED", "IN_PROGRESS", "COMPLETED", "PAID", "OVERDUE"], // Client only sees approved or active milestones
        },
      },
      orderBy: { order: "asc" },
      // Potentially include invoice details if client needs to pay
      include: {
        invoices: {
          where: { status: "PENDING" }, // Fetch only pending invoices for this milestone
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            dueDate: true,
            status: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, milestones });
  } catch (error) {
    console.error("Error fetching client milestones:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc Get details of a single milestone for Admin/Partner/Client
 * @route GET /api/milestones/:milestoneId
 * @access Private/Admin, Private/Partner, Private/Client
 */
exports.getMilestoneDetails = async (req, res) => {
  try {
    const userId = req.user.id; // User ID from authenticated token
    const userRole = req.user.role; // User role (e.g., 'ADMIN', 'PARTNER', 'CLIENT')
    const { milestoneId } = req.params;

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            partnerId: true,
            createdByAdminId: true, // Admin who created the project
          },
        },
        partner: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            gstAmount: true,
            totalAmount: true,
            gstEnabled: true,
            status: true,
            dueDate: true,
            paidAt: true,
          },
        },
        payments: true, // Or select specific fields
      },
    });

    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found." });
    }

    // Authorization based on role
    if (userRole === "CLIENT" && milestone.project.clientId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not the client for this milestone.",
      });
    }
    if (userRole === "PARTNER" && milestone.project.partnerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not the partner for this milestone.",
      });
    }
    // Admin always has access

    res.status(200).json({ success: true, milestone });
  } catch (error) {
    console.error("Error fetching milestone details:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
