import TransactionModel from "../models/transactionsModel.js";
import UserModel from "../models/userModel.js";
import WalletModel from "../models/walletModel.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";
import crypto from "crypto";
import { sendTransactionEmail } from "../utils/emailService.js";
import  Mongoose  from "mongoose";
import { TRANSACTIONS_ENUM, TRANSACTIONS_TYPES } from "../utils/types.js";
const {mongoose} = Mongoose;
// Utility to generate unique transaction IDs
const generateTxnId = () => crypto.randomBytes(8).toString("hex");


export const addTransaction = catchAsync(async (req, res,next) => {
  const {id, amount, type, reference, comment} = req.body;
  if( !id || !amount || !type || !reference || !comment)
  {
      return next(new AppError("All fileds email, amount, type, reference, comment are required",400));
  }

  if (!TRANSACTIONS_TYPES.includes(type)) {
    return next(new AppError("Invalid transaction type", 400));
  }
  const user = await UserModel.findById(id);
  if(!user)
    {
     return next(new AppError("User not found",404));
    } 
  if(user.suspended || !user.verifiedEmail)
  {
    return next(new AppError("User is not active",403));
  }
  const session = await Mongoose.startSession();
  session.startTransaction();
  
  try {

    switch (type) {
      case TRANSACTIONS_ENUM.CREDIT:
        user.balance = (user.balance || 0) + amount;
        user.lifetimeEarnings = (user.lifeimeEarnings || 0)+ amount;
        break;
      case TRANSACTIONS_ENUM.DEBIT:
        if ((user.balance || 0) < amount) {
          throw new AppError("Insufficient funds", 400);
        }
        user.lifetimeEarnings = user.lifetimeEarnings - amount;
        user.balance = user.balance - amount;
        break;
      case TRANSACTIONS_ENUM.WITHDRAWAL:
        if ((user.balance || 0) < amount) {
          throw new AppError("Insufficient funds", 400);
        }
        user.balance = user.balance - amount;
        user.lifetimeWithdrawn = (user.lifetimeWithdrawn||0)+amount;
        break;
      case TRANSACTIONS_ENUM.LOYALITY_POINT_CREDIT:
        user.points = (user.points||0)+amount;
        user.lifetimePointsEarnings = (user.lifetimePointsEarnings||0)+amount;
        break;
      case TRANSACTIONS_ENUM.LOYALITY_POINT_DEBIT:
        if ((user.points || 0) < amount) {
          throw new AppError("Insufficient funds", 400);
        }
        user.points = user.points-amount;
        user.lifetimePointsWithdrawn = user.lifetimePointsWithdrawn + amount;
        break;
      default:
        throw new AppError("invalid transaction type");
    }
    // // let walletUpdateQuery = {};
    // if (type === TRANSACTIONS_ENUM.CREDIT) {
    //   // walletUpdateQuery = {
    //   //   $inc: { walletBalance: amount, lifetimeEarnings: amount },
    //   // };
    //   user.balance = (user.balance || 0) + amount;
    //   user.lifetimeEarnings = (user.lifeimeEarnings || 0)+ amount;
    // } else {
    //   // debit or withdraw
    //   // Check balance first
    //   // const currentWallet = await WalletModel.findOne({ user: user._id }).session(session);
    //   // if (user.walletBalance < amount) throw new AppError("Wallet not found", 404);
    //   if ((user.balance || 0) < amount) {
    //     throw new AppError("Insufficient funds", 400);
    //   }
    //   if(type === "DEBIT")
    //   {
    //     user.lifetimeEarnings = user.lifetimeEarnings - amount;
    //   }
    //   user.balance = user.balance - amount;
    // }
      // const updatedWallet = await WalletModel.findOneAndUpdate(
      // { user: user._id },
      // walletUpdateQuery,
      // { new: true, session }
    // );
  
    // if (!updatedWallet) throw new AppError("Wallet not found", 404);
    await user.save({session});
    const txnId = generateTxnId();
  
   const trans =  await TransactionModel.create(
      [
        {
          user: user._id,
          type,
          amount,
          reference,
          txnId,
          comment,
        },
      ],
      { session }
    );
  
    await session.commitTransaction();
    session.endSession();
    sendTransactionEmail(user.email,type,amount);
    res.status(200).json({
      success:true,
      data: { transaction: trans, user: user },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});

// Get user wallet details
export const getWallet = catchAsync(async (req, res,next) => {
  const { email } = req.body;
  const user = await UserModel.findOne({email});
  if(!user)
  {
    return next(new AppError("User not found",404));
  }
  if(user.suspended || !user.verifiedEmail)
  {
    return next(new AppError("User is banned",403));
  }
  const wallet = await WalletModel.findOne({user:user._id});
  if(!wallet)
  {
    return next(new AppError("Wallet not found",404));
  }
  res.status(200).json({
    success:true,
    data:{user,wallet}
  });
});

export const getTransactions = catchAsync(async (req, res,next) => {
  const { id, page = 1, limit = 20 } = req.body;
  const user = await UserModel.findById( id );
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  // if (user.suspended || !user.verifiedEmail) {
  //   return next(new AppError("User is not active", 403));
  // }

  const skip = (page - 1) * limit;
  const transactions = await TransactionModel.find({ user: user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await TransactionModel.countDocuments({ user: user._id });

  res.status(200).json({
    success: true,
    data: {
      transactions,
      total,
      page: page,
      limit: limit
    },
  });
})