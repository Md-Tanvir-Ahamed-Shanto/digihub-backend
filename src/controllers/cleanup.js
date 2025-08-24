const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

const deleteAllExceptAdmin = async (req, res) => {
  try {
    // Optional: Protect with an admin secret key
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Wrap in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.partner.deleteMany();
      await tx.client.deleteMany();
      await tx.lead.deleteMany();
      await tx.project.deleteMany();
      await tx.milestone.deleteMany();
      await tx.payment.deleteMany();
      await tx.invoice.deleteMany();
      await tx.withdrawal.deleteMany();
      await tx.paymentCard.deleteMany();
      await tx.supportResponse.deleteMany();
      await tx.supportTicket.deleteMany();
      await tx.expense.deleteMany();
      await tx.revenue.deleteMany();
      await tx.summary.deleteMany();
      await tx.gstReport.deleteMany();
      await tx.maintenanceSubscription.deleteMany();
      await tx.contactSubmission.deleteMany();
      await tx.solution.deleteMany();
      await tx.caseStudy.deleteMany();
      await tx.paymentDetails.deleteMany();
    });

    res.json({ message: 'All data deleted except Admin table' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete data' });
  }
};

module.exports = { deleteAllExceptAdmin };
