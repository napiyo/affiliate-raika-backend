import TransactionModel from "../models/transactionsModel.js";
import UserModel from "../models/userModel.js";
import WalletModel from "../models/walletModel.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";
import crypto from "crypto";
import { sendTransactionEmail } from "../utils/emailService.js";
import Mongoose from "mongoose";
import {
  Role,
  TRANSACTIONS_ENUM,
  TRANSACTIONS_STATUS,
  TRANSACTIONS_STATUS_ENUM,
  TRANSACTIONS_TYPES,
  TRANSACTIONS_TYPES_FOR_SALES,
} from "../utils/types.js";
const { mongoose } = Mongoose;
// Utility to generate unique transaction IDs
export const generateTxnId = () => crypto.randomBytes(8).toString("hex");

export const addLoyalityPoints = async (amount, phone, telecrmUser, leadId, session,paymentId) => {
  if (!telecrmUser || !telecrmUser._id) {
    throw new AppError("invalid telecrm user", 403);
  }
  if (telecrmUser._id.toString() !== String(process.env.TELECRM_USER_ID)) {
    throw new AppError("invalid user, user is not telecrm, can't add loyalty", 403);
  }
  if ( !phone || !leadId) {
    throw new AppError("Amount or phone or leadId is missing", 403);
  }
  if(!amount || isNaN(amount) || amount < 1 || !paymentId)
  {
    return
  }

  // compute loyalty as floor(amount * 0.05)
  const amt = Math.floor(Number(amount) * 0.05);
  if (amt <= 0) return;

  // ensure phone is string
  const phoneStr = String(phone);
  let user = await UserModel.findOne({ phone: phoneStr }).session(session);

  if (!user) {
    // create single document and return the created doc (do NOT destructure)
    user = await UserModel.create([{ phone: phoneStr, name: process.env.NEW_USER_NAME }], { session });
    // create([...], { session }) returns an array of docs
    if (Array.isArray(user)) user = user[0];
  }

  const txnId = paymentId;
  await TransactionModel.create(
    [
      {
        user: user._id,
        createdBy: telecrmUser._id,
        type: TRANSACTIONS_ENUM.LOYALITY_POINT_CREDIT,
        amount: amt,
        reference: leadId,
        txnId,
        status: TRANSACTIONS_STATUS_ENUM.PENDING,
        comment: "Loyalty Points Added",
      },
    ],
    { session }
  );
};
export const addTransaction = catchAsync(async (req, res, next) => {
  const { id, amount, type, reference, comment } = req.body; // id = affiliate
  let { status } = req.body;
  const { user: currentUser } = req.body; // who initiated this transaction
  if (!id || !amount || !type || !reference || !comment) {
    return next(
      new AppError(
        "All fileds email, amount, type, reference, comment are required",
        400
      )
    );
  }
  if (amount < 1) {
    return next(new AppError("Invalid amount it must > 0", 400));
  }
  if (!TRANSACTIONS_STATUS.includes(status)) {
    status = TRANSACTIONS_STATUS_ENUM.SUCCESS;
  }
  const transactionTypesAllowed =
    currentUser?.role == Role.ADMIN
      ? TRANSACTIONS_TYPES
      : currentUser?.role == Role.SALES
      ? TRANSACTIONS_TYPES_FOR_SALES
      : [];
  if (!transactionTypesAllowed.includes(type)) {
    return next(new AppError("Invalid transaction type", 400));
  }
  const user = await UserModel.findById(id); // affilate
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.suspended) {
    return next(new AppError("User is not active", 403));
  }

  let commision = Math.floor(amount);
  if (commision < 1) {
    res.status(200).json({
      success: true,
    });
    return;
  }
  const session = await Mongoose.startSession();
  session.startTransaction();

  try {
    if (commision > 0 && status == TRANSACTIONS_STATUS_ENUM.SUCCESS) {
      switch (type) {
        case TRANSACTIONS_ENUM.CREDIT:
          user.balance = (user.balance || 0) + commision;
          user.lifetimeEarnings = (user.lifetimeEarnings || 0) + commision;
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
          user.lifetimeWithdrawn = (user.lifetimeWithdrawn || 0) + commision;
          break;
        case TRANSACTIONS_ENUM.LOYALITY_POINT_CREDIT:
          user.points = (user.points || 0) + commision;
          user.lifetimePointsEarnings =
            (user.lifetimePointsEarnings || 0) + commision;
          break;
        case TRANSACTIONS_ENUM.LOYALITY_POINT_DEBIT:
          if ((user.points || 0) < commision) {
            throw new AppError("Insufficient funds", 400);
          }
          user.points = user.points - commision;
          user.lifetimePointsWithdrawn =
            user.lifetimePointsWithdrawn + commision;
          break;
        default:
          throw new AppError("invalid transaction type");
      }
      await user.save({ session });
    }
    const txnId = generateTxnId();

    const trans = await TransactionModel.create(
      [
        {
          user: user._id,
          createdBy: currentUser._id,
          type,
          amount: commision,
          reference,
          txnId,
          status: status,
          comment,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    sendTransactionEmail(user.email, type, commision);
    res.status(200).json({
      success: true,
      data: { transaction: trans[0], user: user },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});

export const cancelAllPaymentsForLead = async (leadId,session) => {
  await TransactionModel.updateMany(
    { reference: leadId, status: TRANSACTIONS_STATUS_ENUM.PENDING },
    { $set: { status: TRANSACTIONS_STATUS_ENUM.CANCLED } },{session}
  );
};

export const doneAllPaymentsForLead = async (leadId, session) => {
  const transactionsToBeUpdated = await TransactionModel.find({
    reference: leadId,
    status: TRANSACTIONS_STATUS_ENUM.PENDING,
  }).session(session);

  for (const val of transactionsToBeUpdated) {
    const user = await UserModel.findById(val.user).session(session);
    const commission = Number(val.amount) || 0;

    switch (val.type) {
      case TRANSACTIONS_ENUM.CREDIT:
        user.balance = (user.balance || 0) + commission;
        user.lifetimeEarnings = (user.lifetimeEarnings || 0) + commission;
        break;

      case TRANSACTIONS_ENUM.DEBIT:
        if ((user.balance || 0) < commission) {
          throw new AppError("Insufficient funds", 400);
        }
        user.lifetimeEarnings -= commission;
        user.balance -= commission;
        break;

      case TRANSACTIONS_ENUM.WITHDRAWAL:
        if ((user.balance || 0) < commission) {
          throw new AppError("Insufficient funds", 400);
        }
        user.balance -= commission;
        user.lifetimeWithdrawn = (user.lifetimeWithdrawn || 0) + commission;
        break;

      case TRANSACTIONS_ENUM.LOYALITY_POINT_CREDIT:
        user.points = (user.points || 0) + commission;
        user.lifetimePointsEarnings = (user.lifetimePointsEarnings || 0) + commission;
        break;

      case TRANSACTIONS_ENUM.LOYALITY_POINT_DEBIT:
        if ((user.points || 0) < commission) {
          throw new AppError("Insufficient points", 400);
        }
        user.points -= commission;
        user.lifetimePointsWithdrawn = (user.lifetimePointsWithdrawn || 0) + commission;
        break;

      default:
        throw new AppError("Invalid transaction type", 400);
    }

    await user.save({ session });
  }

  await TransactionModel.updateMany(
    { reference: leadId, status: TRANSACTIONS_STATUS_ENUM.PENDING },
    { $set: { status: TRANSACTIONS_STATUS_ENUM.SUCCESS } },
    { session }
  );
};

// Get user wallet details
export const getWallet = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.suspended || !user.verifiedEmail) {
    return next(new AppError("User is banned", 403));
  }
  const wallet = await WalletModel.findOne({ user: user._id });
  if (!wallet) {
    return next(new AppError("Wallet not found", 404));
  }
  res.status(200).json({
    success: true,
    data: { user, wallet },
  });
});

export const getTransactions = catchAsync(async (req, res, next) => {
  const { id, page = 1, limit = 25, search } = req.body;
  const user = await UserModel.findById(id);
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
      limit: limit,
    },
  });
});
