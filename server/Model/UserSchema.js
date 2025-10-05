import mongoose from "mongoose";

// ✅ Define User schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true, // mobile number must be unique
      match: /^[6-9]\d{9}$/, // validates Indian mobile numbers
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ✅ Create User model
const User = mongoose.model("User", userSchema);

export default User;
