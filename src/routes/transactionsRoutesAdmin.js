import { Router } from 'express';
import { addTransaction, getTransactions, getWallet } from '../controllers/transactionAdminController.js';



const router = Router();

router.post('/addTransaction', addTransaction);
// router.post("/getWallet", getWallet);
router.post('/getTranscations', getTransactions);


export default router;