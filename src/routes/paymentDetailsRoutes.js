const express = require('express');
const {
  createPaymentDetails,
  getPaymentDetails,
  updatePaymentDetails,
  deletePaymentDetails,
} = require('../controllers/paymentDetailsController');

const router = express.Router();

// Route to create new payment details for a specific partner
router.post('/:partnerId', createPaymentDetails);

// Route to get payment details for a specific partner
router.get('/:partnerId', getPaymentDetails);

// Route to update payment details for a specific partner
router.put('/:partnerId', updatePaymentDetails);

// Route to delete payment details for a specific partner
router.delete('/:partnerId', deletePaymentDetails);

module.exports = router;