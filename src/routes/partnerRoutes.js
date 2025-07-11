const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/login', partnerController.partnerLogin);
router.post('/register', partnerController.registerPartner);
router.post('/set-password', partnerController.setPartnerPasswordAndActivate);

router.get('/profile', authMiddleware.authenticate, roleMiddleware.isPartner, partnerController.getPartnerProfile);
router.put('/profile', authMiddleware.authenticate, roleMiddleware.isPartner, partnerController.updatePartnerProfile);
router.post('/withdrawals/request', authMiddleware.authenticate, roleMiddleware.isPartner, partnerController.requestWithdrawal);
router.get('/withdrawals', authMiddleware.authenticate, roleMiddleware.isPartner, partnerController.getPartnerWithdrawals);

router.post('/', authMiddleware.authenticate, roleMiddleware.isAdmin, partnerController.createPartnerByAdmin);
router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, partnerController.getAllPartnersForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, partnerController.getPartnerByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, partnerController.updatePartnerByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, partnerController.deletePartnerByAdmin);

module.exports = router;