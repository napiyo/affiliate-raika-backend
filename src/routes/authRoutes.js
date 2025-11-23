import { Router } from 'express';
import { completeProfile, forgotPassword, getMe, login, logout, protect, sendOTP, verifyEmail, verifyOTP } from '../controllers/authController.js';


const router = Router();

// Route for user registration
// router.post('/register', register);
router.get('/verify/:token', verifyEmail);

// Route for user login
// router.post('/login', login);
router.get('/logout', logout);
// router.put("/reset/:token",resetPassword);
// router.post('/forgotpassword', forgotPassword);
router.get('/me',protect, getMe);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/complete-profile', completeProfile);




export default router;