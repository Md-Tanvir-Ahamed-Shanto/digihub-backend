const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', leadController.submitLead);

router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, leadController.getAllLeadsForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, leadController.getLeadByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, leadController.updateLeadByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, leadController.deleteLeadByAdmin);

module.exports = router;