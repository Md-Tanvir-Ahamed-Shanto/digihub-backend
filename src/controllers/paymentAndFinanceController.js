const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const Decimal = require("decimal.js");

exports.processMilestonePayment = async (req, res) => {
  const { milestoneId, totalAmount } = req.body;
  const clientId = req.user.id;
  if (!milestoneId || !totalAmount) {
    return res
      .status(400)
      .json({ message: "Milestone ID and total amount are required." });
  }

  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true, partner: true, invoices: true }, // Include invoices
    });

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found." });
    }

    // Verify that the milestone belongs to the authenticated client
    if (milestone.project.clientId !== clientId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to pay for this milestone." });
    }

    // Check if milestone is already paid
    if (milestone.status === "COMPLETED") {
      return res
        .status(409)
        .json({ message: "This milestone has already been paid." });
    }

    // Convert costs to Decimal for calculation
    const partnerCost = new Decimal(milestone.cost);
    const clientCost = new Decimal(milestone.clientCost);
    const totalAmountPaid = new Decimal(totalAmount);

    // Calculate earnings and profit
    const adminProfit = clientCost.minus(partnerCost);
    const gstAmount = totalAmountPaid.minus(clientCost);

    // Use a Prisma transaction to ensure all updates succeed or fail together
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Record the payment
      const payment = await prisma.payment.create({
        data: {
          amount: partnerCost,
          totalAmount: totalAmountPaid,
          gstAmount: gstAmount,
          method: "STRIPE",
          status: "COMPLETED",
          paidAt: new Date(),
          clientId: clientId,
          projectId: milestone.projectId,
          milestoneId: milestoneId,
        },
      });

      // 2. Update Partner's total earnings and available balance
      await prisma.partner.update({
        where: { id: milestone.partnerId },
        data: {
          totalEarnings: { increment: partnerCost },
          availableBalance: { increment: partnerCost },
        },
      });

      // 3. Update monthly revenue for the company (admin)
      const currentMonth = new Date().toLocaleString("default", {
        month: "short",
      });

      const existingRevenue = await prisma.revenue.findFirst({
        where: { month: currentMonth },
      });

      if (existingRevenue) {
        // Update the existing record
        await prisma.revenue.update({
          where: { id: existingRevenue.id },
          data: {
            amount: {
              increment: adminProfit.toNumber(),
            },
          },
        });
      } else {
        // Create a new record
        await prisma.revenue.create({
          data: {
            month: currentMonth,
            amount: adminProfit.toNumber(),
          },
        });
      }

      // 4. Update GST collected
      const currentPeriod = `Q${
        Math.floor(new Date().getMonth() / 3) + 1
      } ${new Date().getFullYear()}`;

      const existingGstReport = await prisma.gstReport.findFirst({
        where: { period: currentPeriod },
      });

      if (existingGstReport) {
        await prisma.gstReport.update({
          where: { id: existingGstReport.id },
          data: {
            gstCollected: {
              increment: gstAmount,
            },
          },
        });
      } else {
        await prisma.gstReport.create({
          data: {
            period: currentPeriod,
            gstCollected: gstAmount,
            gstPaid: 0,
            status: "PENDING",
            dueDate: new Date(),
          },
        });
      }

      // 5. Update Milestone status
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "PAID", completedAt: new Date() },
      });

      // 6. Update all related invoices' status to 'PAID'
      const invoiceUpdates = milestone.invoices.map((invoice) =>
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID" },
        })
      );
      await Promise.all(invoiceUpdates);

      return { payment, milestone, partnerCost, adminProfit, gstAmount };
    });

    res.status(200).json({
      message:
        "Payment processed successfully. Partner earnings, admin revenue, GST report, and invoice updated.",
      data: result,
    });
  } catch (error) {
    console.error("Error processing milestone payment:", error);
    res
      .status(500)
      .json({ message: "Failed to process payment. Internal server error." });
  }
};

/**
 * @route GET /api/finance/summary/revenue
 * @desc Get a summary of all monthly revenue for the admin dashboard.
 * @access Private (Admin)
 */
exports.getRevenueSummary = async (req, res) => {
  try {
    const revenues = await prisma.revenue.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json(revenues);
  } catch (error) {
    console.error("Error fetching revenue summary:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * @route GET /api/finance/summary/gst
 * @desc Get a summary of GST reports for the admin dashboard.
 * @access Private (Admin)
 */
exports.getGstSummary = async (req, res) => {
  try {
    const gstReports = await prisma.gstReport.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(gstReports);
  } catch (error) {
    console.error("Error fetching GST summary:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * @route GET /api/finance/partner/:id/earnings
 * @desc Get a specific partner's earnings and balance.
 * @access Private (Admin)
 */
exports.getPartnerEarnings = async (req, res) => {
  const { id } = req.params;
  try {
    const partner = await prisma.partner.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        totalEarnings: true,
        availableBalance: true,
      },
    });

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    res.status(200).json(partner);
  } catch (error) {
    console.error("Error fetching partner earnings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
