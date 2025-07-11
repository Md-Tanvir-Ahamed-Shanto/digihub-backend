const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/register', clientController.registerClient);
router.post('/login', clientController.clientLogin);
router.post('/set-password', clientController.setClientPasswordAndActivate);

router.get('/profile', authMiddleware.authenticate, roleMiddleware.isClient, clientController.getClientProfile);
router.put('/profile', authMiddleware.authenticate, roleMiddleware.isClient, clientController.updateClientProfile);
router.get('/my-leads', authMiddleware.authenticate, roleMiddleware.isClient, clientController.getClientLeads);

router.get('/', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.getAllClientsForAdmin);
router.get('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.getClientByIdForAdmin);
router.put('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.updateClientByAdmin);
router.delete('/:id', authMiddleware.authenticate, roleMiddleware.isAdmin, clientController.deleteClientByAdmin);

module.exports = router;