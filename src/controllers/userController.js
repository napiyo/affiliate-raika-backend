// src/controllers/userController.js

import UserModel from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
// import WalletModel from '../models/walletModel.js';
import TransactionModel from '../models/transactionsModel.js';
import { Role, TRANSACTIONS_TYPES, USER_ROLES } from '../utils/types.js';



export const changePassword = catchAsync(async (req, res,next) => {
    const {oldpassword, newpassword} = req.body;
    if(!oldpassword || !newpassword)
    {
        return next("old password and new password both are required",400);
    }
    if(!req.body.user)
    {
        return next("user not logged in or invalid user",403);
    }
    const user = UserModel.findById(req.body.user._id).select("+password");
    if (!user || !(await user.comparePassword(oldpassword))) {
        return next(new AppError('Incorrect old password', 401));
    }
    user.password = newpassword;
    await user.save();
    res.status(200).json({success:true,data:"Password changed"});

    
});

export const getMyTransactions = catchAsync(async (req, res,next) => {
    const {limit=25,page=1,type,from,to,search,id} = req.body;

    if(limit<1||page<1)
    {
        return next(new AppError("invalid page or limit",400))
    }
    const skip = (page-1)*limit
    if(!req.body.user)
    {
      return next(new AppError("User not found",404));
    }
    
    const query = {};
    if(req.body.user.role === Role.ADMIN || req.body.user.role === Role.SALES)
    {
        if(id && id!=null && id != 'undefined'){ query.user = id;}
       
    }
    else
    {

        query.user=req.body.user._id
    }
   
    if (type && TRANSACTIONS_TYPES.includes(type)) {
        query.type = type;
      }
      
    
        if(typeof from === "number" && !isNaN(new Date(from).getTime())&&
        typeof to === "number" && !isNaN(new Date(to).getTime()))
        {
            query.createdAt = {
                $gte: new Date(from),
                $lte: new Date(to),
              };
        }
        // console.log(query);
        
    if(search && search.trim()!==''){
            query.$or = [
               { txnId:{ $regex: search, $options: "i" }},
                {reference:{ $regex: search, $options: "i" }},
                {comment:{ $regex: search, $options: "i" }},

            ];
    }

    
    const transactions = await TransactionModel.find(query).sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    const totalCount = await TransactionModel.countDocuments(query);
    if(!transactions)
    {
      return next(new AppError("Transaction not found",404));
    }
    res.status(200).json({
      success:true,
      data:{
        transactions,
        total:totalCount,
        limit,
        page

      },
    });
  });

  export const getWallet = catchAsync(async (req, res, next) => {
    if (!req.body.user) {
      return next(new AppError("User not found", 404));
    }
  
    const { id } = req.query;
    // console.log("sdfasdf===",id);
    
    const loggedInUser = req.body.user;
  
    let walletData;
  
    if (loggedInUser.role === Role.ADMIN) {
      if (id) {
        // Admin requesting wallet of specific user
        walletData = await UserModel.findById( id);
        if (!walletData) {
          return next(new AppError("Wallet not found for this user", 404));
        }
      } else {
        // Admin requesting combined wallet data
        const agg = await UserModel.aggregate([
          {
            $group: {
              _id: null,
              balance: { $sum: "$balance" },
              lifetimeEarnings: { $sum: "$lifetimeEarnings" },
              lifetimeWithdrawn: { $sum: "$lifetimeWithdrawn" },
              points: { $sum: "$points" },
              lifetimePointsEarnings: { $sum: "$lifetimePointsEarnings" },
              lifetimePointsWithdrawn: { $sum: "$lifetimePointsWithdrawn" },
              totalLeads: { $sum: "$totalLeads" },
              totalLeadsConv: { $sum: "$totalLeadsConv" }
            },
          },
        ]);
  
        walletData = agg.length > 0 ? agg[0] : {
          balance: 0,
          lifetimeEarnings: 0,
          lifetimeWithdrawn: 0,
          points: 0,
          lifetimePointsEarnings: 0,
          lifetimePointsWithdrawn: 0,
          totalLeadsConv:0,
          totalLeads:0
        };
      }
    } else {
      // Normal user → only their own wallet
    //   walletData = await UserModel.findById({ user: loggedInUser._id });
    walletData = loggedInUser;
      if (!walletData) {
        return next(new AppError("Wallet not found", 404));
      }
    }
  
    res.status(200).json({
      success: true,
      data: walletData,
    });
  });

export const getUserbyEmail = catchAsync(async (req, res, next) => {
    const {search} = req.body;
    if(!search || search.trim() =='' )
    {
        return next(new AppError("search is required",400));
    }
    
    const query = {
        $or: [
          { email: { $regex: search, $options: "i" } }, // case-insensitive
          { name: { $regex: search, $options: "i" } },
        ],
      };

      if (!isNaN(Number(search))) {
        query.$or.push({ phone: Number(search) });
      }
    
    
    const user = await UserModel.find(query);
    if(!user)
    {
        return next(new AppError("No user found",404));
    }
    res.status(200).json({
        success: true,
        data: user
        
    });
});

export const getUserbyId = catchAsync(async (req, res, next) => {
    const {id} = req.params;
    if(!id)
    {
        return next(new AppError("id is required",400));
    }
    const user = await UserModel.findById(id);
    if(!user)
    {
        return next(new AppError("No user found",404));
    }
    res.status(200).json({
        success: true,
        data: user
        
    });
});
export const getAllUsers= catchAsync(async (req, res, next) => {
    const { page = 1, limit = 10 } = req.body;
    
 
    
    const skip = (page - 1) * limit;
 // Build filter
    const filter = {};
    const { sortby, verified, suspended } = req.body 
    if (verified && verified !== "all") filter.verifiedEmail = verified === "yes";
    if (suspended && suspended !== "all") filter.suspended = suspended === "yes";

    // Build sort
    const sort= {};
    if (sortby && sortby !== "default") {
   
        sort[sortby] = -1;
    }
    
    const users = await UserModel.find(filter).sort(sort)
        .skip(skip)
        .limit(Number(limit));

    const total = await UserModel.countDocuments(filter);

    res.status(200).json({
        success: true,
        data:{
            results: users.length,
            total,
            page: Number(page),
            limit: Number(limit),
            users
        }
    });
});

export const suspend = catchAsync(async (req, res, next) => {
    const {email} = req.body;
    if(!email)
    {
        return next(new AppError("email is required",400));
    }
    const user = await UserModel.findOne({email});
    if(!user)
    {
        return next(new AppError("No user found",404));
    }
    user.suspend = true;
    res.status(200).json({
        success: true,
        data:"user suspended"
    });
});

export const unsuspend = catchAsync(async (req, res, next) => {
    const {email} = req.body;
    if(!email)
    {
        return next(new AppError("email is required",400));
    }
    const user = await UserModel.findOne({email});
    if(!user)
    {
        return next(new AppError("No user found",404));
    }
    user.suspend = false;
    res.status(200).json({
        success: true,
        data:"user unsuspended"
    });
});

export const updateUser = catchAsync(async (req, res, next) => {
    const {email,name,role,bankName,ifsc,accountNumber,upiId,suspended} = req.body;
    if(!email)
    {
        return next(new AppError("email is required",400));
    }
    const user = await UserModel.findOne({email});
    if(!user)
    {
        return next(new AppError("No user found",404));
    }
    if(suspended && user.suspended != suspended && typeof suspended == 'boolean' ) user.suspended = suspended;
    if(upiId && user.upiId != upiId) user.upiId = upiId;
    if(accountNumber && user.accountNumber != accountNumber) user.accountNumber = accountNumber;
    if(ifsc && user.ifsc != ifsc) user.ifsc = ifsc;
    if(bankName && user.bankName != bankName) user.bankName = bankName;
    if(name && user.name != bankName) user.name = name;
    if(role && user.role != role && USER_ROLES.includes(role)) user.role=role;

    await user.save()
    res.status(200).json({
        success: true,
        data:user
    });
});



