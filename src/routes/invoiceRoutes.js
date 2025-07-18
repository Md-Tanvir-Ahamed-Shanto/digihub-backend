// src/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Client-Specific Invoice Routes ---
router.get('/client', authMiddleware.authenticate, roleMiddleware.isClient, invoiceController.getClientInvoices);
router.get('/client/:id', authMiddleware.authenticate, roleMiddleware.isClient, invoiceController.getClientInvoiceById);

// --- Admin-Specific Invoice Routes ---
router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, invoiceController.createInvoiceByAdmin);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, invoiceController.getAllInvoicesForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, invoiceController.getInvoiceByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, invoiceController.updateInvoiceByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, invoiceController.deleteInvoiceByAdmin);



module.exports = router;