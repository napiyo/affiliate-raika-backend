import { Router } from 'express';
import { forgotPassword, getMe, login, logout, protect, register, resetPassword, verifyEmail } from '../controllers/authController.js';


const router = Router();

// Route for user registration
router.post('/register', register);
router.get('/verify/:token', verifyEmail);

// Route for user login
router.post('/login', login);
router.get('/logout', logout);
router.put("/reset/:token",resetPassword);
router.post('/forgotpassword', forgotPassword);
router.get('/me',protect, getMe);





export default router;