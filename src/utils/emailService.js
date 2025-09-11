import nodemailer from "nodemailer";


const catchAsync = (fn) => async (...args) => {
  try {
       console.log(...args);
       
      return await fn(...args);
  } catch (error) {
     
      console.error('email service error occured:', error.message);
    
  }
};




let transporter;
try {
  transporter = nodemailer.createTransport({
    service: "Gmail", // or Outlook, or use SMTP
    auth: {
      user: process.env.EMAIL_FOR_NOTIFICATIONS,
      pass: process.env.EMAIL_PASS,
    },
  });
} catch (err) {
  console.error("Failed to create email transporter:", err);
  throw err;
}

export const sendVerificationEmail = catchAsync(async (email, url) => {
     console.log(url);
     
        await transporter.sendMail({
            from: `"Raika photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
            to: email,
            subject: "Verify your email",
            html: `<p>Please click the link to verify:</p><a href="${url}">${url}</a>`,
        });
      
     
});

export const sendResetTokenEmail = catchAsync(async (email, url) => {
    
      await transporter.sendMail({
        from: `"Raika photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
        to: email,
        subject: "Reset your password",
        html: `<p>Please click the link to reset your password:</p><a href="${url}">${url}</a>`,
      });
    
  });

export const sendTransactionEmail = catchAsync(async(email,type,amount)=>
{
 
    await transporter.sendMail({
      from: `"Raika photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
      to: [email,process.env.ADMIN_EMAIL_TO_GET_UPDATE],
      subject: "Transaction happened on your account",
      html: `<p>Hi \n ${amount} has been ${type} on your account</p>`,
    });

  
  
 
});

export const sendEmailToAdmin = catchAsync(async(amount,userEmail,leadId)=>
  {
   
      await transporter.sendMail({
        from: `"Raika photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
        to: process.env.ADMIN_EMAIL_TO_GET_UPDATE,
        subject: "[URGENT] Transaction dispute - Needs Attention",
        html: `<p>Hi \n ${amount} amount for ${userEmail} on lead id ${leadId} was already credited.\n but again we have received request to add a different amount\n This means, you might have updated amount on shoot completed lead. \n this needs to verifed, if this amount needs to re-correct, please debit amount from user account which we had previously added\n and add this amount manually</p>`,
      });
  });