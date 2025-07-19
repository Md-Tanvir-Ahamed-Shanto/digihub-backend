const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Create a new Payment Card for a specific client
const createPaymentCard = async (req, res) => {
  const { clientId } = req.params; // Assuming client ID comes from URL params
  const { cardNumber, cardName, expiryDate, cvv } = req.body;

  if (!cardNumber || !cardName || !expiryDate || !cvv || !clientId) {
    return res.status(400).json({ message: 'All fields (cardNumber, cardName, expiryDate, cvv, clientId) are required.' });
  }

  try {
    // Check if the client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found.' });
    }

    const newPaymentCard = await prisma.paymentCard.create({
      data: {
        cardNumber,
        cardName,
        expiryDate,
        cvv,
        clientId,
      },
    });
    res.status(201).json(newPaymentCard);
  } catch (error) {
    console.error('Error creating payment card:', error);
    res.status(500).json({ message: 'Error creating payment card', error: error.message });
  }
};

// Get all Payment Cards for a specific client
const getPaymentCardsByClient = async (req, res) => {
  const { clientId } = req.params;

  try {
    const paymentCards = await prisma.paymentCard.findMany({
      where: { clientId: clientId }
    });
    res.status(200).json(paymentCards);
  } catch (error) {
    console.error('Error fetching payment cards for client:', error);
    res.status(500).json({ message: 'Error fetching payment cards', error: error.message });
  }
};

// Get a single Payment Card by its ID
const getPaymentCardById = async (req, res) => {
  const { id } = req.params;

  try {
    const paymentCard = await prisma.paymentCard.findUnique({
      where: { id: id },
      include: { client: true }, // Optionally include client details
    });

    if (!paymentCard) {
      return res.status(404).json({ message: 'Payment card not found.' });
    }
    res.status(200).json(paymentCard);
  } catch (error) {
    console.error('Error fetching payment card by ID:', error);
    res.status(500).json({ message: 'Error fetching payment card', error: error.message });
  }
};

// Update a Payment Card
const updatePaymentCard = async (req, res) => {
  const { id } = req.params;
  const { cardNumber, cardName, expiryDate, cvv } = req.body;

  try {
    const updatedPaymentCard = await prisma.paymentCard.update({
      where: { id: id },
      data: {
        cardNumber,
        cardName,
        expiryDate,
        cvv,
      },
    });
    res.status(200).json(updatedPaymentCard);
  } catch (error) {
    if (error.code === 'P2025') { // Prisma error code for record not found
      return res.status(404).json({ message: 'Payment card not found.' });
    }
    console.error('Error updating payment card:', error);
    res.status(500).json({ message: 'Error updating payment card', error: error.message });
  }
};

// Delete a Payment Card
const deletePaymentCard = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.paymentCard.delete({
      where: { id: id },
    });
    res.status(204).send(); // No content for successful deletion
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Payment card not found.' });
    }
    console.error('Error deleting payment card:', error);
    res.status(500).json({ message: 'Error deleting payment card', error: error.message });
  }
};

module.exports = {
  createPaymentCard,
  getPaymentCardsByClient,
  getPaymentCardById,
  updatePaymentCard,
  deletePaymentCard,
};