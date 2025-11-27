import UserModel from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import LeadsModel from "../models/leadsModel.js";
import TransactionModel from "../models/transactionsModel.js";
import axios from "axios";
import {
  InProgressStatus,
  LeadSource,
  Role,
  statusAllowed,
  TRANSACTIONS_ENUM,
  TRANSACTIONS_STATUS,
  TRANSACTIONS_STATUS_ENUM,
} from "../utils/types.js";
import { sendEmailToAdmin } from "../utils/emailService.js";
import Leads from "../models/leadsModel.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import {
  addLoyalityPoints,
  cancelAllPaymentsForLead,
  doneAllPaymentsForLead,
  generateTxnId,
} from "./transactionAdminController.js";

export const addLead = catchAsync(async (req, res, next) => {
  const { email, phone, name, alternatephone, requirements } = req.body;
  if (!name || !phone || !requirements) {
    return next(
      new AppError("name, phone, and requirement are required fields", 400)
    );
  }

  if (!req.body.user) {
    return next(new AppError("User not logged in or invalid user", 403));
  }

  const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead`;
  const data = {
    fields: {
      name,
      phone,
      requirements,
      alternatephone,
      email,
      referrer_name: req.body.user.name,
      referrer_email_1: req.body.user.email ,
      referrer_phone: req.body.user.phone,
      lead_source: LeadSource.manual,
    },
  };
  const leadgen = await axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${process.env.TELECRM_TOKEN}`,
    },
  });

  await LeadsModel.create({
    user: req.body.user._id,
    leadId: leadgen.data.lead_id,
    name,
    phone,
    email,
    requirement: requirements,
    alterPhone: alternatephone,
  });
  req.body.user.totalLeads = req.body.user.totalLeads + 1;
  await req.body.user.save();
  res.status(201).json({ success: true, data: "Lead added" });
});

export const getLeadbyId = catchAsync(async (req, res, next) => {
  const { leadId } = req.params;
  if (!leadId) {
    return next(new AppError("Lead ID is required", 400));
  }
  if (!req.body.user) {
    return next(new AppError("User not logged in or invalid user", 403));
  }
  const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead/${leadId}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.TELECRM_TOKEN}`,
    },
  });
  res.status(200).json({ success: true, data: response.data });
});

export const searchLead = catchAsync(async (req, res, next) => {
  const { query = {}, page = 0, limit = 20 } = req.body;
  const skip = limit * page;
  // if(!query)
  //     {
  //         return next(new AppError("query is required",400));
  //     }
  if (!req.body.user) {
    return next(new AppError("User not logged in or invalid user", 403));
  }
  if (query.status == "InProgress") {
    query.status = InProgressStatus;
  }

  const filter = {};

  // Status can be single value or array
  if (query.status) {
    if (Array.isArray(query.status)) {
      filter.status = { $in: query.status };
    } else {
      filter.status = query.status;
    }
  }

  // User filter
  if (req.body.user.role != Role.ADMIN) {
    filter.user = mongoose.Types.ObjectId(req.body.user._id);
  }
  if (query.search && query.search != "undefined" && query.search.trim()) {
    const term = query.search.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { leadId: { $regex: term, $options: "i" } },
    ];
  }

  // Date range
  if (query.created_on && query.created_on.from && query.created_on.to) {
    filter.createdAt = {
      $gte: new Date(query.created_on.from),
      $lte: new Date(query.created_on.to),
    };
  }

  const data = await Leads.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  const modifiedLeads = data.map((element) => {
    let phone = element.phone;

    let email = element.email || "-";
    let leadSource = element.source;
    let isManual = leadSource == LeadSource.manual;
    if (phone && !isManual) {
      const lastTwo = phone.slice(-2);
      phone = "*".repeat(phone.length - 2) + lastTwo;
    }
    if (email && !isManual) {
      const [localPart, domain] = email.split("@");

      if (localPart && domain) {
        const visible = localPart.slice(0, Math.min(3, localPart.length));
        const masked = "*".repeat(
          Math.max(localPart.length - visible.length, 0)
        );

        email = `${visible}${masked}@${domain}`;
      }
    }

    if (element?.status && !statusAllowed.includes(element.status)) {
      element.status = "InProgress";
    }

    if (element.status && element.status === "Order Completed") {
      element.status = "OrderCompleted";
    }
    return {
      email: email || "",
      phone,
      name: element.name,
      user: element.user,
      requirement: element.requirement,
      source: element.source,
      createdOn: element.createdAt,
      status: element.status || "Lost",
      id: element.leadId,
    };
  });
  const totalResults = (await Leads.countDocuments(filter)) || 0;
  res
    .status(200)
    .json({
      success: true,
      data: { data: modifiedLeads, totalResults, skip, limit },
    });

  // res.status(200).json({success:true,data:response.data});
});
export const searchLeadinTeleCRM = catchAsync(async (req, res, next) => {
  const { query = {}, page = 0, limit = 20 } = req.body;
  const skip = limit * page;
  // if(!query)
  //     {
  //         return next(new AppError("query is required",400));
  //     }
  if (!req.body.user) {
    return next(new AppError("User not logged in or invalid user", 403));
  }
  if (query.status == "InProgress") {
    query.status = InProgressStatus;
  }
  const searchQuery = {
    fields: {
      referrer_email: req.body.user.email,
      ...query,
    },
  };
  // const searchQuery = {date:query.date}
  query.refferer = req.body.user.email;

  const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead/search?skip=${skip}&limit=${limit}`;
  await axios
    .post(url, searchQuery, {
      headers: {
        Authorization: `Bearer ${process.env.TELECRM_TOKEN}`,
      },
    })
    .then((response) => {
      // console.log(response.data.data[0]);

      const modifiedLeads = response.data.data.map((element) => {
        let phone = element.fields?.phone;

        let email = element.fields?.email;
        let leadSource = element.fields?.lead_source;
        let isManual = leadSource == LeadSource.manual;
        if (phone && !isManual) {
          const lastTwo = phone.slice(-2);
          phone = "*".repeat(phone.length - 2) + lastTwo;
        }
        if (email && !isManual) {
          const [localPart, domain] = email.split("@");

          if (localPart && domain) {
            const visible = localPart.slice(0, Math.min(3, localPart.length));
            const masked = "*".repeat(
              Math.max(localPart.length - visible.length, 0)
            );

            email = `${visible}${masked}@${domain}`;
          }
        }
        const statusAllowed = ["New", "Lost", "Shoot Completed"];
        if (element?.status && !statusAllowed.includes(element.status)) {
          element.status = "InProgress";
        }

        if (element.status && element.status === "Shoot Completed") {
          element.status = "ShootCompleted";
        }
        return {
          email: email || "",
          phone,
          name: element.fields.name,
          requirement: element.fields.requirements,
          source: element.fieldslead_source,
          createdOn: element.fields.created_on,
          status: element.status || "Lost",
          id: element.id,
        };
      });
      response.data.data = modifiedLeads;
      res.status(200).json({ success: true, data: response.data });
    })
    .catch((err) => {
      console.log(err);

      return next(
        new AppError(
          err.response?.data?.error?.message || "Opps CRM connection failed",
          err.response?.status || 500
        )
      );
    });

  // res.status(200).json({success:true,data:response.data});
});

export const searchLeadbyAdmin = catchAsync(async (req, res, next) => {
  const { query, page = 0, limit = 20 } = req.body;
  const skip = limit * page;
  if (!query) {
    return next(new AppError("query is required", 400));
  }
  const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead/search?skip=${skip}&limit=${limit}`;
  const response = await axios.get(url, query, {
    headers: {
      Authorization: `Bearer ${process.env.TELECRM_TOKEN}`,
    },
  });
  res.status(200).json({ success: true, data: response.data });
});
export const checkIfTeleCRM = catchAsync(async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (
    !authHeader ||
    authHeader !== `Bearer ${process.env.LEAD_UPDATE_SECRET}`
  ) {
    return next(new AppError(" Unauthorized", 401));
  }
  req.body.user = await User.findById(process.env.TELECRM_USER_ID);
  if (!req.body.user) {
    return next(new AppError("Telecrm user not found", 500));
  }
  next();
});
export const updateLead = catchAsync(async (req, res, next) => {
  const { amount, status, leadId, phone , paymentId} = req.body;

  if (!leadId || !status || !phone ) {
    return next(new AppError("leadId, status, phone are required", 400));
  }
  let trimmedPhone = String(phone);
  if (trimmedPhone.startsWith("91") && trimmedPhone.length === 12) {
    trimmedPhone = trimmedPhone.substring(2);
  }
  if(paymentId)
      {
          const transactionWithSameId = await TransactionModel.findOne({txnId:paymentId});
          if(transactionWithSameId) {
            throw new AppError("Duplicate Payment ID",409)
          }
      }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
    
     
      if (status === process.env.CREDIT_IF_STAGE_IS) {
        await doneAllPaymentsForLead(leadId, session);
      } else if (status === "Lost") {
        await cancelAllPaymentsForLead(leadId, session);
      }
      await addLoyalityPoints(amount, trimmedPhone, req.body.user, leadId, session, paymentId);
      
      const lead = await LeadsModel.findOne({ leadId }).session(session);

      if (lead) {
        if (lead.status !== process.env.CREDIT_IF_STAGE_IS && lead.status !== "Lost") {
          if (lead.status !== status) {
            lead.status = status;
            await lead.save({ session });
          }

          if (status === process.env.CREDIT_IF_STAGE_IS) {
            await UserModel.updateOne(
              { _id: lead.user },
              { $inc: { totalLeadsConv: 1 } },
              { session }
            );
          }
          if (amount && !isNaN(amount) && Number(amount) > 0) {
            const affiliate = await UserModel.findById(lead.user._id).session(session);
            let commission = Number(amount);
            if (affiliate && affiliate.role === Role.GOLDUSER) {
              commission = commission * 0.2;
            } else {
              commission = commission * 0.1;
            }
            commission = Math.floor(commission);
            const txnId = generateTxnId()
            if(affiliate && !affiliate.suspended )
            {

                await TransactionModel.create(
                    [
                        {
                            user: lead.user._id,
                            createdBy: req.body.user._id,
                            type: TRANSACTIONS_ENUM.CREDIT,
                            amount: commission,
                            reference: leadId,
                            txnId,
                            status: TRANSACTIONS_STATUS_ENUM.PENDING,
                            comment: "Commission added",
                        },
                    ],
                    { session }
                );
            }
        }
        }
      }
      
    }); 
    res.status(200).json({ success: true, data: "Lead updated" });
  } catch (err) {
    res.status(400).json({ success: false, data: "Lead update failed", error: err.message });
  } finally {
    session.endSession();
  }
});
export const addLeadbyLink = catchAsync(async (req, res, next) => {
  const { email, phone, name, alternatephone, requirements } = req.body;
  const { token } = req.params;
  if (!name || !phone || !requirements) {
    return next(
      new AppError("name, phone, and requirement are required fields", 400)
    );
  }

  const user = await UserModel.findOne({ referralToken: token });
  // if (!user || user.suspended) {
  //   return next(new AppError("referral token is not valid", 403));
  // }
  const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead`;
  const data = {
      fields: {
        name,
        phone,
        requirements,
        alternatephone,
        email,
        referrer_name:  user.name,
        referrer_email_1: user.email,
        referrer_phone: user.phone,
        lead_source: LeadSource.link,
      },
    };
  const leadgen = await axios.post(
    url,
    data,
    {
      headers: {
        Authorization: `Bearer ${process.env.TELECRM_TOKEN}`,
      },
    }
  );

 await LeadsModel.create({
    user: user?._id,
    leadId: leadgen.data.lead_id,
    name,
    phone,
    email,
    requirement: requirements,
    alterPhone: alternatephone,
    source:LeadSource.link
  });
  if(user)
  {
    user.totalLeads = user.totalLeads + 1;
    await user.save();
  }
  res.status(201).json({ success: true, data: "Lead added" });
});
