import express, { json } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import leadRoutes from './routes/leadRoutes.js'
import dashboardRoutes from './routes/dashboard.js'
import transactionsAdminRoutes from './routes/transactionsRoutesAdmin.js'
import errorHandler from './middlewares/errorHandler.js';
import cookieParser from "cookie-parser";
import { protect } from './controllers/authController.js';
import { roleCheck } from './middlewares/roleCheck.js';
import { Role } from './utils/types.js';
import cors from 'cors';
const app = express();

// Middleware
app.use(helmet());
app.use(cookieParser());   
app.use(json());
app.use(morgan('dev'));
app.use(rateLimit({
    windowMs:  1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}));


app.use(
    cors({
    
      credentials: true, 
      origin:process.env.FRONT_END_BASE_URL
    })
  );
// Routes
app.use('/auth', authRoutes);
app.use('/users', protect, userRoutes);
app.use("/admin/transactions",protect,roleCheck(Role.ADMIN,Role.SALES),transactionsAdminRoutes);
app.use('/leads',leadRoutes);
app.use('/dashboard',protect,dashboardRoutes);
// Error handling middleware
app.use(errorHandler);

export default app;