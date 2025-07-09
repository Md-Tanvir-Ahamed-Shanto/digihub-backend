const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const upload = require('../config/multerConfig');

router.post('/login', adminController.adminLogin);

router.use(authMiddleware.authenticate);
router.use(roleMiddleware.isAdmin);
router.post('/', upload.single('image'), adminController.createAdmin);
router.put('/:id', upload.single('image'), adminController.updateAdmin);
router.get('/', adminController.getAllAdmins);
router.get('/:id', adminController.getAdminById);
router.delete('/:id', adminController.deleteAdmin);
router.put('/:id/change-password', adminController.changeAdminPassword); // Change own password


module.exports = router;