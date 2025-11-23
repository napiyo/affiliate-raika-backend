// authController.js
import UserModel from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import crypto from 'crypto';
import { sendResetTokenEmail } from '../utils/emailService.js';
import Wallet from '../models/walletModel.js';
import { sendOtpWhatsApp, verifyOtpLogic } from '../utils/otpService.js';
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

// Send OTP to phone number
export const sendOTP = catchAsync(async (req, res, next) => {
    const { phone } = req.body;

    // Validate phone number
    if (!phone || phone.length !== 10) {
        return next(new AppError('Please provide a valid 10-digit phone number', 400));
    }

    try {
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresIn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Check if user exists
        let user = await UserModel.findOne({ phone });

        if (user) {
            // Update OTP for existing user
            user.otp = otp;
            user.otpExpiresIn = otpExpiresIn;
            await user.save({ validateBeforeSave: false });
        } else {
            // Create a temporary document with OTP (user not registered yet)
            user = await UserModel.create({
                phone,
                otp,
                otpExpiresIn,
                name: 'akdsfjaskljfei', // Placeholder, will be updated during profile completion
            });
        }

        // Send OTP via WhatsApp
        const whatsappResult = await sendOtpWhatsApp(phone, otp);

        if (!whatsappResult.success) {
            return next(new AppError('Failed to send OTP. Please try again.', 500));
        }

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully to your WhatsApp',
        });
    } catch (err) {
        next(err);
    }
});

// Verify OTP
export const verifyOTP = catchAsync(async (req, res, next) => {
    const { phone, otp } = req.body;

    // Validate inputs
    if (!phone || !otp) {
        return next(new AppError('Please provide phone number and OTP', 400));
    }

    if (otp.length !== 6) {
        return next(new AppError('OTP must be 6 digits', 400));
    }

    try {
        // Find user by phone with OTP and otpExpiresIn selected
        const user = await UserModel.findOne({ phone })
            .select('+otp +otpExpiresIn');

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        // Check if OTP is expired
        if (!user.otpExpiresIn || new Date() > user.otpExpiresIn) {
            return next(new AppError('OTP has expired. Please request a new one.', 400));
        }

        // Verify OTP
        if (user.otp !== otp) {
            return next(new AppError('Invalid OTP', 400));
        }

        // Clear OTP
        user.otp = undefined;
        user.otpExpiresIn = undefined;

        // Check if user is new (name is still 'Temporary')
        const isNewUser = user.name === 'akdsfjaskljfei';

        await user.save({ validateBeforeSave: false });
        if(!isNewUser)
        {
            const token = signToken(user._id);
            setCookie(res, token);
        }
        res.status(200).json({
            success: true,
            data: {
                isNewUser,
                user: {
                    _id: user._id,
                    phone: user.phone,
                    name: user.name,
                },
            },
        });
    } catch (err) {
        next(err);
    }
});
function isEmail(text) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(text);
}
// Complete profile for new users
export const completeProfile = catchAsync(async (req, res, next) => {
    const { phone, name , email} = req.body;

    // Validate inputs
    if (!phone || !name) {
        return next(new AppError('Please provide phone number and name', 400));
    }

    if (name.trim().length < 2) {
        return next(new AppError('Name must be at least 2 characters', 400));
    }
    if(email && !isEmail(text))
    {
        return next(new AppError('Invalid Email', 400));
        
    }

    try {
        // Find user by phone
        const user = await UserModel.findOne({ phone });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        // Check if user is new
        if (user.name !== 'akdsfjaskljfei') {
            return next(new AppError('User already has a completed profile', 400));
        }

        // Update user profile
        user.name = name.trim();
        user.email = email
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;

        await user.save();

        // Create wallet for new user
        // try {
        //     await Wallet.create({ user: user._id });
        // } catch (walletErr) {
        //     console.error('Wallet creation error:', walletErr);
        //     // Don't fail the entire request if wallet creation fails
        // }

        // Generate JWT token
        const token = signToken(user._id);
        setCookie(res, token);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                },
            },
        });
    } catch (err) {
        next(err);
    }
});



export const logout = catchAsync(async (req, res, next) => {
    clearCookie(res, req.cookies.jwt);
    res.status(200).json({ success: true, message: "see you soon" });
});

export const protect = catchAsync(async (req, res, next) => {
    let token;

    if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new AppError('invalid-user: You are not logged in! Please log in to get access.', 400));
    }

    const decoded = await promisify(verify)(token, process.env.JWT_SECRET);

    const currentUser = await UserModel.findById(decoded.id);
    if (!currentUser) {
        return next(new AppError('invalid-user: The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.suspended) {
        return next(new AppError('invalid-user: Your account has been suspended, please contact Admin', 403));
    }

    req.body.user = currentUser;
    next();
});

export const getMe = catchAsync(async (req, res, next) => {
    const currentUser = req.body.user;

    if (!currentUser) {
        return next(new AppError('invalid user search', 404));
    }

    res.status(200).json({
        success: true,
        data: currentUser,
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
    // const jwttoken = signToken(user._id);

//    setCookie(res,jwttoken);
    // Remove password from output
    // user.password = undefined;
    res.status(200).json({
        success: true,
        data: user,
    });
  });