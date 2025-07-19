// src/routes/withdrawalRoutes.js
const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// --- Partner-Specific Withdrawal Routes ---
router.post(
    '/request',
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    withdrawalController.requestWithdrawal
);
router.get(
    '/partner',
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    withdrawalController.getPartnerWithdrawals
);
router.get(
    '/partner/:id',
    authMiddleware.authenticate,
    roleMiddleware.isPartner,
    withdrawalController.getPartnerWithdrawalById
);


// --- Admin-Specific Withdrawal Routes ---
router.get(
    '/admin',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    withdrawalController.getAllWithdrawalsForAdmin
);
router.get(
    '/admin/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    withdrawalController.getWithdrawalByIdForAdmin
);
router.put(
    '/admin/:id/process',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    withdrawalController.processWithdrawalByAdmin
);
router.delete(
    '/admin/:id',
    authMiddleware.authenticate,
    roleMiddleware.isAdmin,
    withdrawalController.deleteWithdrawalByAdmin
);

module.exports = router;