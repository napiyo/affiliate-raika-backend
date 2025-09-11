import { Router } from 'express';
import { addLead, addLeadbyLink, getLeadbyId, searchLead, searchLeadbyAdmin, updateLead } from '../controllers/leadController.js';
import { protect } from '../controllers/authController.js';
import { roleCheck } from '../middlewares/roleCheck.js';
import { Role } from '../utils/types.js';
import { addTransaction } from '../controllers/transactionAdminController.js';



const router = Router();

router.post('/add',protect, addLead);
router.get('/:leadId',protect, getLeadbyId);
router.post('/search',protect,searchLead);
router.post('/admin/search',protect,roleCheck(Role.ADMIN), searchLeadbyAdmin);
router.get('/update/',updateLead,addTransaction); // invalid, made this get, so user dont need to pass body, for simplicity
router.post('/external/:token',addLeadbyLink);



export default router;