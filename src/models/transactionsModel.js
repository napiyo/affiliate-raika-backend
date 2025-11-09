import mongoose from "mongoose";
import { TRANSACTIONS_STATUS, TRANSACTIONS_STATUS_ENUM, TRANSACTIONS_TYPES } from "../utils/types.js";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: TRANSACTIONS_TYPES, required: true },
    amount: { type: Number, required: true,set: (v) => Math.floor(v) },
    reference: { type: String },
    txnId: { type: String, required: true, unique: true },
    comment:{type:String, required:true},
    status:{type:String, enum:TRANSACTIONS_STATUS,default:TRANSACTIONS_STATUS_ENUM.PENDING}
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transactions", transactionSchema);
export default Transaction;
