import UserModel from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import crypto from 'crypto';
import { sendResetTokenEmail, sendVerificationEmail } from '../utils/emailService.js';
import Wallet from '../models/walletModel.js';
const {verify, sign} = jwt;
import mongoose from 'mongoose';
import { clearCookie, setCookie } from '../utils/jwtUtils.js';
import { Role } from '../utils/types.js';

// Generate JWT token
const signToken = (id) => {
    return sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

export const register = catchAsync(async (req, res, next) => {
    const { name, email, password ,phone} = req.body;

    // Check if all required fields are provided
    if (!name || !email || !password || !phone) {
        return next(new AppError('Please provide name, email,phone and password!', 400));
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
        return next(new AppError('User with this email already exists!, Try to login', 409));
    }
    const emailVerificationtoken = crypto.randomBytes(32).toString("hex")+email;
    // const session = await mongoose.startSession();
    // session.startTransaction();
    try{

        // Create new user
        const [newUser] = await UserModel.create([{ name, email, password,phone,
            verificationToken: emailVerificationtoken,
            verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
        }]);
        if(!newUser)
        {
            throw new AppError("coulnt create new account",500);
        }
        // const [userWallet] = await Wallet.create([{user:newUser._id}],{session});
        // if(!userWallet)
        // {
        //     throw new AppError("user wallet creation failed",500);
        // }
        // await session.commitTransaction();
        // session.endSession();
        const verifyUrl = `${process.env.FRONT_END_BASE_URL}/auth/verify?token=${emailVerificationtoken}`;
        sendVerificationEmail(email, verifyUrl);
        res.status(201).json({
            success: true,
            data: "verification email sent"
        });
    }
    catch(err)
    {
        // await session.abortTransaction();
        // session.endSession();
        next(err);
    }
});

export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
        return next(new AppError('Please provide email and password!', 400));
    }

    // Find user by email
    const user = await UserModel.findOne({ email }).select("+password");

    // Check if user exists and password is correct
    if (!user || !(await user.comparePassword(password))) {
        return next(new AppError('Incorrect email or password', 401));
    }
    if(user.suspended )
    {
        return next(new AppError("You're account is not active",403));
    }
    if(!user.verifiedEmail)
        {
            const emailVerificationtoken = crypto.randomBytes(32).toString("hex")+user._id;
            
            user.verificationToken = emailVerificationtoken;
            user.verificationTokenExpires= Date.now() + 24 * 60 * 60 * 1000;
            const verifyUrl = `${process.env.FRONT_END_BASE_URL}/auth/verify?token=${emailVerificationtoken}`;
            await user.save();
            await sendVerificationEmail(email, verifyUrl);
            return next( new AppError("User email is not verified, verification email is sent",403));
        }
            // Generate JWT token
    user.password = undefined;
    const token = signToken(user._id);

   setCookie(res,token);

    // Remove password from output
    // user.password = undefined;

    res.status(200).json({
        success: true,
        data: user,
    });
});
export const logout = catchAsync(async (req, res, next) => {
        clearCookie(res, req.cookies.jwt);
        res.status(200).json({success:true,message:"see you soon"});
});
export const protect = catchAsync(async (req, res, next) => {
    let token;
    
    // Check for token in cookie
    if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }

    // Check if token is provided
    if (!token) {
        return next(new AppError('invalid-user: You are not logged in! Please log in to get access.', 400));
    }

    // Verify token
    const decoded = await promisify(verify)(token, process.env.JWT_SECRET);

    // Check if user still exists
    const currentUser = await UserModel.findById(decoded.id);
    if (!currentUser) {
        return next(new AppError('invalid-user: The user belonging to this token no longer exists.', 401));
    }
    if(currentUser.suspended) 
    {
        return next(new AppError('invalid-user: Your account has be suspended, please contact Admin', 403));   
    }
    // Grant access to protected route
    req.body.user = currentUser;
    
    next();
});

export const getMe = catchAsync(async (req, res, next) => {

    //    const {id} = req.query;
       let currentUser = req.body.user;

       
    //    if(id && id != null && currentUser.role == Role.ADMIN)
    //    {
        
    //     currentUser = await UserModel.findById(id);
    //     // console.log(currentUser);
        
    //    }
       if(!currentUser)
       {
        return next(new AppError('invalid user search',404));
       }
  
    
    
    res.status(200).json({
        success: true,
        data: currentUser
        
    });
});

export const verifyEmail = catchAsync(async (req, res,next) => {
    const { token } = req.params;
    if(!token)
    {
        return next(new AppError("token is required",400));
    }
    const user = await UserModel.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    }).select("+verificationToken +verificationTokenExpires");
  
    if (!user) {
      return next(new AppError("Invalid or expired token",400))
    }
  
    user.verifiedEmail = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    const jwttoken = signToken(user._id);

   setCookie(res,jwttoken);
    // Remove password from output
    user.password = undefined;
    res.status(200).json({
        success: true,
        data: user,
    });
  });
  
  export const forgotPassword = catchAsync( async (req, res,next) => {
    const { email } = req.body;
    if(!email)
    {
        return next(new AppError("email is required",400));
    }
    const user = await UserModel.findOne({ email }).select("+resetPasswordToken +resetPasswordExpires");
    if (!user) {
      return next(new AppError("user not found",404));
    }
  
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 min expiry
    await user.save({ validateBeforeSave: false });
  
    // Reset URL
    const resetURL = `${process.env.FRONT_END_BASE_URL}/auth/resetpassword?token=${resetToken}`;
    await sendResetTokenEmail(email,resetURL);
    res.status(200).json({
        success: true,
        data:"Reset password link sent to email"
    })
});
export const resetPassword = catchAsync(async (req, res,next) => {
    const { token } = req.params;
    const { password } = req.body;
    if(!token || !password)
    {
        return next(new AppError("token and password are required to rest password",400));
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  
    const user = await UserModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires +password");
  
    if (!user) {
      return next(new AppError("Token expired or invalid token",404));
    }
  
    user.password = password; 
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
  
    res.status(200).json({success:true, data: "Password reset successful, you can now log in" });
  });

  
