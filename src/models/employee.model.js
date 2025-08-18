import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";

const tabPermissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, required: true }
});
// Single permission schema
const permissionSchema = new Schema({
  module: { type: String, required: true },
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  updateStatus: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  tabs: [tabPermissionSchema]
});


const employeeSchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        phoneNumber: { type: String, required: false, unique: true, sparse: true },
        emp_code: {
            type: String,
            required: true,
        },
        factory: { type: String, required: true },
        role: {
            type: String,
            required: true,
        },
        address: {
            type: String,
            required: true,

        },
        permissions: {
      type: [permissionSchema],
      default: []
    },
     password: { type: String, required: true, minlength: 6 },
    },
    { timestamps: true }
);

// 🔹 Pre-save hook to hash password
employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // only hash if modified
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔹 Method to check password validity
employeeSchema.methods.isPasswordCorrect = async function (enterpassword) {
  console.log("Comparing:", enterpassword, "with", this.password);
  return await bcrypt.compare(enterpassword, this.password);
};

export const Employee = mongoose.model("Employee", employeeSchema);
