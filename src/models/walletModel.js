import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0,set: (v) => Math.floor(v) },             
    lifetimeEarnings: { type: Number, default: 0,set: (v) => Math.floor(v) },
    lifetimeWithdrawn: { type: Number, default: 0,set: (v) => Math.floor(v) },
    totalLeads:{type:Number,default:0},
    totalLeadsConv:{type:Number,default:0},
    
  },
  { timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;
