import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: String,
    required: true
  },
  fuel: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  isHybrid: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    trim: true
  },
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  brandLogo: {
    type: String,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

export default mongoose.model("Vehicle", vehicleSchema);
