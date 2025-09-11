import { Router } from 'express';
import {  changePassword, getAllUsers, getMyTransactions, getUserbyEmail, getUserbyId, getWallet, suspend, unsuspend, updateUser } from '../controllers/userController.js';
import { roleCheck } from '../middlewares/roleCheck.js';
import { Role } from '../utils/types.js';


const router = Router();

// router.get('/me', getMe);
router.put("/changepassword", changePassword);
// router.get("/mywallet",getMyWallet);
router.post("/mytrasaction",getMyTransactions);
router.get("/wallet",getWallet);
router.post('/', roleCheck(Role.ADMIN),getAllUsers);
router.get('/:id', roleCheck(Role.ADMIN),getUserbyId);
router.post('/userbyemail',roleCheck(Role.ADMIN), getUserbyEmail);
router.post('/suspend',roleCheck(Role.ADMIN), suspend );
router.post('/unsuspend',roleCheck(Role.ADMIN), unsuspend );
router.post('/update',roleCheck(Role.ADMIN), updateUser );


export default router;