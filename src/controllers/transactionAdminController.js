import TransactionModel from "../models/transactionsModel.js";
import UserModel from "../models/userModel.js";
import WalletModel from "../models/walletModel.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";
import crypto from "crypto";
import { sendTransactionEmail } from "../utils/emailService.js";
import  Mongoose  from "mongoose";
import { Role, TRANSACTIONS_ENUM, TRANSACTIONS_TYPES, TRANSACTIONS_TYPES_FOR_SALES } from "../utils/types.js";
const {mongoose} = Mongoose;
// Utility to generate unique transaction IDs
const generateTxnId = () => crypto.randomBytes(8).toString("hex");


export const addTransaction = catchAsync(async (req, res,next) => {
  const {id, amount, type, reference, comment} = req.body; // id = affiliate
  const {user :currentUser} = req.body; // who initiated this transaction
  if( !id || !amount || !type || !reference || !comment)
  {
      return next(new AppError("All fileds email, amount, type, reference, comment are required",400));
  }
  if(amount <1)
  {
    return next(new AppError("Invalid amount it must > 0",400));
  }
  const transactionTypesAllowed = currentUser?.role==Role.ADMIN?TRANSACTIONS_TYPES:currentUser?.role==Role.SALES?TRANSACTIONS_TYPES_FOR_SALES:[]
  if (!transactionTypesAllowed.includes(type)) {
    return next(new AppError("Invalid transaction type", 400));
  }
  const user = await UserModel.findById(id); // affilate
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
  
 
  let commision = amount;
  try {
    if(currentUser._id == process.env.TELECRM_USER_ID &&  type == TRANSACTIONS_ENUM.CREDIT)
      {
          if(user.role == Role.GOLDUSER)
          {
            commision = amount * 0.2;
          }
          else
          {
            commision = amount * 0.1;
          }
  
          // add royalty points
          const pointTobeAdded = amount * 0.05;
          let customer = await UserModel.findOne({phone:req.body.lead.phone});
          if(customer)
          {
            customer.points = (customer.points||0)+pointTobeAdded;
            customer.lifetimePointsEarnings = (customer.lifetimePointsEarnings||0)+pointTobeAdded;
            await customer.save({session});
          }
          else
            {
              customer =  await UserModel.create(
                [
                  {
                    name: req.body.lead.name,
                    email:req.body.lead.email,
                    phone:req.body.lead.phone,
                    password:"sdjfalsdjfeijlkasdjf",
                    points:pointTobeAdded,
                    lifetimePointsEarnings:pointTobeAdded
                  },
                ],
                { session }
              );
            }
            console.log("customer is ",customer);
          const txnIdPoints = generateTxnId();
          const transPoints =  await TransactionModel.create(
            [
              {
                user: customer._id,
                createdBy:currentUser._id,
                type:TRANSACTIONS_ENUM.LOYALITY_POINT_CREDIT,
                amount:pointTobeAdded,
                reference,
                txnId:txnIdPoints,
                comment,
              },
            ],
            { session }
          );

  
      } 
    switch (type) {
      case TRANSACTIONS_ENUM.CREDIT:
        user.balance = (user.balance || 0) + commision;
        user.lifetimeEarnings = (user.lifeimeEarnings || 0)+ commision;
        break;
      case TRANSACTIONS_ENUM.DEBIT:
        if ((user.balance || 0) < commision) {
          throw new AppError("Insufficient funds", 400);
        }
        user.lifetimeEarnings = user.lifetimeEarnings - commision;
        user.balance = user.balance - commision;
        break;
      case TRANSACTIONS_ENUM.WITHDRAWAL:
        if ((user.balance || 0) < commision) {
          throw new AppError("Insufficient funds", 400);
        }
        user.balance = user.balance - commision;
        user.lifetimeWithdrawn = (user.lifetimeWithdrawn||0)+commision;
        break;
      case TRANSACTIONS_ENUM.LOYALITY_POINT_CREDIT:
        user.points = (user.points||0)+commision;
        user.lifetimePointsEarnings = (user.lifetimePointsEarnings||0)+commision;
        break;
      case TRANSACTIONS_ENUM.LOYALITY_POINT_DEBIT:
        if ((user.points || 0) < commision) {
          throw new AppError("Insufficient funds", 400);
        }
        user.points = user.points-commision;
        user.lifetimePointsWithdrawn = user.lifetimePointsWithdrawn + commision;
        break;
      default:
        throw new AppError("invalid transaction type");
    }
    await user.save({session});
    const txnId = generateTxnId();
   console.log("user is ",user);
   
   const trans =  await TransactionModel.create(
      [
        {
          user: user._id,
          createdBy:currentUser._id,
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
      data: { transaction: trans[0], user: user },
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