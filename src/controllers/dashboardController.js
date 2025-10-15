// controllers/walletController.js
import Transaction from "../models/transactionsModel.js";
import Lead from "../models/leadsModel.js";
import mongoose from "mongoose";
import catchAsync from "../utils/catchAsync.js";
import { Role } from "../utils/types.js";
import User from "../models/userModel.js";

export const getEarningOverviewChart = catchAsync( async (req, res) => {

    const loggedInUser = req.body.user; // middleware sets this
    const { userId } = req.body;

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 29); // last 30 days

    // --- Build match query ---
    let matchQuery = {
      createdAt: { $gte: startDate, $lte: today },
      type: { $in: ["CREDIT", "LOYALITY_POINTS_CREDIT"] },
    };

    if (loggedInUser.role === "admin") {
      if (userId) {
        matchQuery.user = new mongoose.Types.ObjectId(userId);
      }
      // else → all users, so no user filter
    } else {
      matchQuery.user = new mongoose.Types.ObjectId(loggedInUser._id);
    }

    const result = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: "$_id.day",
          data: {
            $push: { type: "$_id.type", total: "$totalAmount" },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          credit: {
            $ifNull: [
              {
                $first: {
                  $filter: {
                    input: "$data",
                    as: "item",
                    cond: { $eq: ["$$item.type", "CREDIT"] },
                  },
                },
              },
              { total: 0 },
            ],
          },
          points: {
            $ifNull: [
              {
                $first: {
                  $filter: {
                    input: "$data",
                    as: "item",
                    cond: { $eq: ["$$item.type", "LOYALITY_POINTS_CREDIT"] },
                  },
                },
              },
              { total: 0 },
            ],
          },
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Fill missing days with zeros
    const chartData = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayData = result.find(r => r.date === dateStr);
      chartData.push({
        date: dateStr,
        credit: dayData ? dayData.credit.total : 0,
        points: dayData ? dayData.points.total : 0,
      });
    }

    res.status(200).json({success:true,data:chartData});
  
})





    
    export const getLeadsOverview = catchAsync(async (req, res, next) => {
      if (!req.body.user) {
        return next(new AppError("User not found", 404));
      }
    
      const loggedInUser = req.body.user;
      const { userId } = req.body;
    
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - 29); // last 30 days
    
      // --- Build match query ---
      let matchQuery = {
        createdAt: { $gte: startDate, $lte: today },
      };
    
      if (loggedInUser.role === Role.ADMIN) {
        if (userId) {
          matchQuery.user = new mongoose.Types.ObjectId(userId);
        }
        // else → all users, no filter
      } else {
        matchQuery.user = new mongoose.Types.ObjectId(loggedInUser._id);
      }
    
      const result = await Lead.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.day",
            data: { $push: { status: "$_id.status", count: "$count" } },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            totalLeads: {
              $sum: "$data.count",
            },
            leadsConv: {
              $ifNull: [
                {
                  $first: {
                    $filter: {
                      input: "$data",
                      as: "item",
                      cond: { $eq: ["$$item.status", process.env.CREDIT_IF_STAGE_IS] },
                    },
                  },
                },
                { count: 0 },
              ],
            },
          },
        },
        { $sort: { date: 1 } },
      ]);
    
      // --- Fill missing days with zeros ---
      const chartData = [];
      let totalLeads = 0;
      let totalConverted = 0;
    
      for (let i = 0; i < 30; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayData = result.find(r => r.date === dateStr);
    
        const dailyLeads = dayData ? dayData.totalLeads : 0;
        const dailyConv = dayData ? (dayData.leadsConv.count || 0) : 0;
    
        totalLeads += dailyLeads;
        totalConverted += dailyConv;
    
        chartData.push({
          date: dateStr,
          totalLeads: dailyLeads,
          leadsConv: dailyConv,
        });
      }
    
      res.status(200).json({
        success: true,
        totals: {
          totalLeads,
          totalConverted,
        },
        data: chartData,
      });
    });
    

    export const getTopUsersByLeads = catchAsync(async (req, res, next) => {
        if (!req.body.user) {
          return next(new AppError("User not found", 404));
        }
      
        const loggedInUser = req.body.user;
      
        // only admin can access
        if (loggedInUser.role !== Role.ADMIN) {
          return next(new AppError("Not authorized", 403));
        }
      
        const limit = parseInt(req.query.limit) || 5;
      
        const topUsers = await User.find({})
          .sort({ totalLeads: -1 })
          .limit(limit);
        //   .select("name email totalLeads totalLeadsConv balance points");
      
        res.status(200).json({
          success: true,
          data: topUsers,
        });
      });

      export const getLastTransactions = catchAsync(async (req, res, next) => {
        if (!req.body.user) {
          return next(new AppError("User not found", 404));
        }
      
        const loggedInUser = req.body.user;
      
        // only admin can access
        const query = {};
        if (loggedInUser.role !== Role.ADMIN) {
            query.user = loggedInUser._id;
        }
      
        const limit = parseInt(req.query.limit) || 5;
      
        const lastTransactions = await Transaction.find(query)
          .sort({ createdAt: -1 })
          .limit(limit);
        //   .select("name email totalLeads totalLeadsConv balance points");
      
        res.status(200).json({
          success: true,
          data: lastTransactions,
        });
      });