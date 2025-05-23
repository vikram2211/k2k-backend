import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "./user.model.js";

const adminSchema = new Schema({
    fullName: {
      type: String,
      required: true,
      trim: true
    },
  });
  
 export const Admin = User.discriminator('Admin', adminSchema);
  
