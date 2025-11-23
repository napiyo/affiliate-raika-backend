import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
const {hash,compare} = bcryptjs;
const {Schema, model} = mongoose;
import { customAlphabet } from 'nanoid';
import { USER_ROLES } from '../utils/types.js';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const generateReferralToken = customAlphabet(alphabet, 8);

const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email: {
        type: String,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    // password: {
    //     type: String,
    //     required: true,
    //     select:false
    // },
    role: {
        type: String,
        enum: USER_ROLES,
        default: 'user',
    },
    phone:{
        type:String,
        required: true,
        unique:true
    },
    balance: { type: Number, default: 0,set: (v) => Math.floor(v) },               
    lifetimeEarnings: { type: Number, default: 0,set: (v) => Math.floor(v) },   
    lifetimeWithdrawn: { type: Number, default: 0 ,set: (v) => Math.floor(v)},
    points: { type: Number, default: 0,set: (v) => Math.floor(v) },               
    lifetimePointsEarnings: { type: Number, default: 0,set: (v) => Math.floor(v) },   
    lifetimePointsWithdrawn: { type: Number, default: 0,set: (v) => Math.floor(v) },
    totalLeads:{type:Number,default:0},
    totalLeadsConv:{type:Number,default:0},
    referralToken:{type:String,unique:true, default: () => generateReferralToken()},
    verifiedEmail: { type: Boolean, default: false },
    bankName:{type:String},
    ifsc:{type:String},
    accountNumber:{type:Number},
    upiId:{type:String},
    suspended: { type: Boolean, default: false },
    verificationToken: {type: String, select:false},
    verificationTokenExpires: {type:Date, select:false},
    otp: {type:String, select:false},
    otpExpiresIn: {type:Date, select:false}
    // resetPasswordToken: {type:String, select:false},
    // resetPasswordExpires: {type:Date, select:false}
}, { timestamps: true });

// Hash password before saving
// userSchema.pre('save', async function(next) {
//     if (!this.isModified('password')) return next();
//     this.password = await hash(this.password, 12);
//     next();
// });

// Method to compare password
// userSchema.methods.comparePassword = async function(candidatePassword) {
//     return await compare(candidatePassword, this.password);
// };

const User = model('User', userSchema);

export default User;