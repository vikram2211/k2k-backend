import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";


import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    phoneNumber: { type: String, required: false, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    username: {
      type: String,
      required: true,
    },
    password: { type: String, required: true },
    userType: {
      type: String,
      required: true,
      enum: ["Admin", "Employee"],
    },
    refreshToken: {
      type: String,
    },
    // permissions: [
    //   {
    //     module: { type: String, required: true }, // Module name
    //     actions: {
    //       type: Map,
    //       of: Boolean, // Permissions as key-value pairs
    //       default: {}, // Example: { "view": true, "edit": true }
    //     },
    //   },
    // ],

  },
  { discriminatorKey: "userType", timestamps: true }
);

// userSchema.methods.generateAccessToken = function () {
//   return jwt.sign(
//     {
//       _id: this._id,
//       phoneNumber: this.phoneNumber,
//       fullName: this.fullName,
//     },
//     process.env.ACCESS_TOKEN_SECRET,
//     {
//       expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
//     }
//   );
// };
// userSchema.methods.generateRefreshToken = function () {
//   return jwt.sign(
//     {
//       _id: this._id,
//     },
//     process.env.REFRESH_TOKEN_SECRET,
//     {
//       expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
//     }
//   );
// };

// export const User = mongoose.model("User", userSchema);


// {
//   "_id": "userId1",
//   "name": "John Doe",
//   "email": "john@example.com",
//   "role": "Admin",
//   "permissions": ["createWorkOrders", "manageInventory", "viewReports"],
//   "createdAt": "2024-12-30",
//   "updatedAt": "2024-12-30"
// }


userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
