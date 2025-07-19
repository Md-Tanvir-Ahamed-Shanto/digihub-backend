const express = require('express');
const {
  createPaymentCard,
  getPaymentCardsByClient,
  getPaymentCardById,
  updatePaymentCard,
  deletePaymentCard,
} = require('../controllers/paymentCardController'); // No .js extension needed

const router = express.Router();

// Routes for Payment Cards
router.post('/:clientId', createPaymentCard); // Create a card for a specific client
router.get('/:clientId', getPaymentCardsByClient); // Get all cards for a client
router.get('/payment-cards/:id', getPaymentCardById); // Get a single card by its ID
router.put('/payment-cards/:id', updatePaymentCard); // Update a card by its ID
router.delete('/payment-cards/:id', deletePaymentCard); // Delete a card by its ID

module.exports = router;