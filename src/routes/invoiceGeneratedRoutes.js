const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceGeneratedController');

// GET all invoices
router.get('/', invoiceController.getAllInvoices);

// GET a single invoice by ID
router.get('/:id', invoiceController.getInvoiceById);

// POST to create a new invoice
router.post('/', invoiceController.createInvoice);

// DELETE an invoice by ID
router.delete('/:id', invoiceController.deleteInvoiceById);

module.exports = router;