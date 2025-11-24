const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth');
const authMiddleware = require('../middleware/auth');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/verify-otp', authCtrl.verifyOtp);
router.put('/username', authMiddleware, authCtrl.updateUsername);

module.exports = router;
