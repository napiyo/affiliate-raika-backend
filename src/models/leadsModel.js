import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, default: "New" },
    source: {
        type:String,
         enum: ['affiliate-manual', 'affiliate-link'],
         default: 'affiliate-manual'
    },
    leadId: {type:String, required :true, unique:true},
    name:{type:String,required:true},
    email:{type:String},
    phone:{type:String,required:true},
    alterPhone:{type:String},
    requirement:{type:String,required:true}

  },
  { timestamps: true }
);

const Leads = mongoose.model("Leads", LeadSchema);
export default Leads;
