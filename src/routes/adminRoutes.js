const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');


router.post("/r/a", adminController.createAdmin)
router.post('/login', adminController.adminLogin);

router.use(authMiddleware.authenticate);

// Get and Update Admin's own profile
router.get('/profile', roleMiddleware.isAdmin, adminController.getAdminProfile);
router.put('/profile', roleMiddleware.isAdmin, adminController.updateAdminProfile);

router.post('/', roleMiddleware.isAdmin, adminController.createAdmin);
router.get('/', roleMiddleware.isAdmin, adminController.getAllAdmins);
router.get('/:id', roleMiddleware.isAdmin, adminController.getAdminById);
router.put('/:id', roleMiddleware.isAdmin, adminController.updateAdminById);
router.delete('/:id', roleMiddleware.isAdmin, adminController.deleteAdminById);
router.post("/update-credentials", roleMiddleware.isAdmin, adminController.updateCredentials);

module.exports = router;