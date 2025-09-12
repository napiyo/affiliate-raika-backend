import UserModel from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import WalletModel from '../models/walletModel.js';
import LeadsModel from '../models/leadsModel.js';
import axios from 'axios';
import { InProgressStatus, LeadSource } from '../utils/types.js';
import Transaction from '../models/transactionsModel.js';
import { sendEmailToAdmin } from '../utils/emailService.js';


export const addLead = catchAsync(async (req, res, next) => {
    const {email,phone,name,alternatephone, requirements} = req.body;
    if(!name || !phone || !requirements)
    {
        return next(new AppError("name, phone, and requirement are required fields",400));
    }
  
    if (!req.body.user) {
      return next(new AppError("User not logged in or invalid user", 403));
    }
  

  
    const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead`;
    const data = {"fields":{name,phone,requirements, alternatephone,email,referrer_name:req.body.user.name,
        referrer_email:req.body.user.email,
        lead_source:LeadSource.manual
    }}
    const leadgen = await axios.post(url, data, { 
        headers: {
            Authorization: `Bearer ${process.env.TELECRM_TOKEN}`
        }
    })
    
    await LeadsModel.create({user:req.body.user._id, leadId:leadgen.data.lead_id});
    req.body.user.totalLeads =  req.body.user.totalLeads +1;
    await req.body.user.save();
    res.status(201).json({ success: true, data: "Lead added" });
   
  });
  

export const getLeadbyId = catchAsync(async (req, res, next) => {
    const {leadId} = req.params;
    if(!leadId)
        {
            return next(new AppError("Lead ID is required",400));
        } 
    if(!req.body.user)
    {
        return next(new AppError("User not logged in or invalid user",403));
    }
    const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead/${leadId}`;
    const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.TELECRM_TOKEN}`
        }
      });
    res.status(200).json({success:true,data:response.data});
     


});


export const searchLead = catchAsync(async (req, res, next) => {
    const {query={},page=0,limit=20} = req.body;
    const skip = limit*page;
    // if(!query)
    //     {
    //         return next(new AppError("query is required",400));
    //     } 
    if(!req.body.user)
    {
        return next(new AppError("User not logged in or invalid user",403));
    }
    if(query.status == 'InProgress')
    {
        query.status = InProgressStatus;
    }
    const searchQuery = {"fields":{
        "referrer_email":req.body.user.email,
        ...query}}
    // const searchQuery = {date:query.date}
    query.refferer = req.body.user.email;

    
    const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead/search?skip=${skip}&limit=${limit}`;
     await axios.post(url,searchQuery, {
        headers: {
          Authorization: `Bearer ${process.env.TELECRM_TOKEN}`
        }
      }).then((response)=>{
     
        // console.log(response.data.data[0]);
        
        const modifiedLeads =  response.data.data.map((element)=>{
            let phone = element.fields?.phone;
            let email = element.fields?.email;

           
             if(phone)
            {
                const lastTwo = phone.slice(-2);
                phone = "*".repeat(phone.length - 2) + lastTwo;
            }
            if(email)
                {
                    const [localPart, domain] = email.split("@");

                    if (localPart && domain) {
                        const visible = localPart.slice(0, Math.min(3, localPart.length));
                        const masked = "*".repeat(Math.max(localPart.length - visible.length, 0));
                        
                        email =  `${visible}${masked}@${domain}`;
                    }
                }
            const statusAllowed = ['New','Lost','Shoot Completed']
            if(element?.status && !statusAllowed.includes(element.status) )
            {
              
                element.status = 'InProgress'
            }
           
            if(element.status && element.status === 'Shoot Completed')
                {
                     element.status = 'ShootCompleted';
                }
            return {
                email: email || "",
                phone,
                name: element.fields.name,
                requirement: element.fields.requirements,
                source:element.fieldslead_source,
                createdOn:element.fields.created_on,
                status:element.status || "Lost",
                id:element.id,
            }
        })
        response.data.data = modifiedLeads;
        res.status(200).json({success:true,data:response.data});
      }).catch((err)=>{
       
        console.log(err);
        
        return next(new AppError(err.response?.data?.error?.message || "Opps CRM connection failed",err.response?.status || 500))
        
      });
     
    // res.status(200).json({success:true,data:response.data});
      
});

export const searchLeadbyAdmin = catchAsync(async (req, res, next) => {
    const {query,page=0,limit=20} = req.body;
    const skip = limit*page;
    if(!query)
        {
            return next(new AppError("query is required",400));
        } 
    const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead/search?skip=${skip}&limit=${limit}`;
    const response = await axios.get(url,query, {
        headers: {
          Authorization: `Bearer ${process.env.TELECRM_TOKEN}`
        }
      });
        res.status(200).json({success:true,data:response.data});
      
});

export const updateLead = catchAsync(async(req,res,next)=>{
    const {amount,status,leadId}  = req.body;
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${process.env.LEAD_UPDATE_SECRET}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if( !leadId || !status || !amount)
    {
        return next(new AppError(" leadid, status are required",400));
    }
    if(token != process.env.LEAD_UPDATE_SECRET)
    {
        return next(new AppError("token is not valid",403));
    }
   const lead =  await LeadsModel.findOne(
        { leadId: leadId }); 
    const userInDb = await UserModel.findById(lead.user);
   
    if(lead.status == CREDIT_IF_STAGE_IS )
    {
        // status changes, debit credit amount
        sendEmailToAdmin(amount,leadId,userInDb.email);
        return next(new AppError("Lead is already completed, you can not add more amount"));
        
    }
    if(lead.status != CREDIT_IF_STAGE_IS && status == CREDIT_IF_STAGE_IS)
    {
        req.body.type = "CREDIT";
        req.body.reference = leadId;
        req.body.email = userInDb.email;
        req.body.user = userInDb;
        req.body.comment = "commission for lead"

        
       return next();
    }
    
    res.status(400).json({success:false,data:"something went wrong"});
})

export const addLeadbyLink = catchAsync(async(req,res,next)=>{
    const {email,phone,name,alternatephone, requirement} = req.body;
    const {token} = req.params;
    if(!name || !phone || !requirement)
        {
            return next(new AppError("name, phone, and requirement are required fields",400));
        }

    const user = await UserModel.findOne({referralToken:token});
    if(!user || user.suspended)
    {
        return next(new AppError("referral token is not valid",403));
    }
    const url = `https://next.telecrm.in/autoupdate/v2/enterprise/${process.env.ENTERPRISE_ID}/lead`;
    
    const leadgen = await axios.post(url, {name,phone,requirement, alternatephone,email,referrer:user.email,leadsource:"affiliate-link"}, { 
        headers: {
            Authorization: `Bearer ${process.env.TELECRM_TOKEN}`
        }
    });

    await LeadsModel.create({user:user._id,source:"affiliate-link", leadId:leadgen.data.lead_id});
    user.totalLeads  = user.totalLeads + 1;
    await user.save();
    res.status(201).json({ success: true, data: "Lead added" });
})