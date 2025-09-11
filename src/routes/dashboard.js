import { Router } from "express";
import { getEarningOverviewChart, getLastTransactions, getLeadsOverview, getTopUsersByLeads } from "../controllers/dashboardController.js";
import { roleCheck } from "../middlewares/roleCheck.js";
import { Role } from "../utils/types.js";
// import { getLeadsPerformance } from "../controllers/dashboardController.js";

const router = Router();

router.post('/earningOverview',getEarningOverviewChart);
router.get('/leadsOverview',getLeadsOverview);
router.get('/topusers',roleCheck(Role.ADMIN),getTopUsersByLeads);
router.get('/lastTransactions',getLastTransactions);


export default router;