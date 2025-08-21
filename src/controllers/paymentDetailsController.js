const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Create new payment details for a partner
exports.createPaymentDetails = async (req, res) => {
  const { bankName, accountName, accountNo, routingNo, paypalEmail } = req.body;
  const { partnerId } = req.params;

  // Basic validation
  if (!accountNo || !partnerId) {
    return res.status(400).json({ message: 'Account number and partner ID are required.' });
  }

  try {
    // Check if partner already has payment details
    const existingDetails = await prisma.paymentDetails.findFirst({
      where: { partnerId },
    });

    if (existingDetails) {
      return res.status(409).json({ message: 'Payment details for this partner already exist. Use PUT to update.' });
    }

    const paymentDetails = await prisma.paymentDetails.create({
      data: {
        bankName,
        accountName,
        accountNo,
        routingNo,
        paypalEmail,
        partner: {
          connect: { id: partnerId },
        },
      },
    });

    res.status(201).json({ 
      message: 'Payment details created successfully.', 
      data: paymentDetails 
    });
  } catch (error) {
    console.error('Error creating payment details:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Get payment details by partner ID
exports.getPaymentDetails = async (req, res) => {
  const { partnerId } = req.params;

  try {
    const paymentDetails = await prisma.paymentDetails.findFirst({
      where: { partnerId },
      include: { partner: true },
    });

    if (!paymentDetails) {
      return res.status(404).json({ message: 'Payment details not found for this partner.' });
    }

    res.status(200).json({ data: paymentDetails });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Update payment details by partner ID
exports.updatePaymentDetails = async (req, res) => {
  const { partnerId } = req.params;
  const { bankName, accountName, accountNo, routingNo, paypalEmail } = req.body;

  try {
    const updatedDetails = await prisma.paymentDetails.update({
      where: { partnerId },
      data: {
        bankName,
        accountName,
        accountNo,
        routingNo,
        paypalEmail,
      },
    });

    res.status(200).json({ 
      message: 'Payment details updated successfully.', 
      data: updatedDetails 
    });
  } catch (error) {
    console.error('Error updating payment details:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Payment details not found.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Delete payment details by partner ID
exports.deletePaymentDetails = async (req, res) => {
  const { partnerId } = req.params;

  try {
    await prisma.paymentDetails.delete({
      where: { partnerId },
    });

    res.status(200).json({ message: 'Payment details deleted successfully.' });
  } catch (error) {
    console.error('Error deleting payment details:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Payment details not found.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};