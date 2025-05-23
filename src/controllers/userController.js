import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

import mongoose from "mongoose";
import Joi from "joi";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    console.log("Finding user by ID:", userId);
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    console.log("Generating access token");
    const accessToken = user.generateAccessToken();

    console.log("Generating refresh token");
    const refreshToken = user.generateRefreshToken();

    console.log("Saving refresh token to user document");
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    console.log("Tokens generated and saved successfully");
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error in generateAccessAndRefreshTokens:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokens"
    );
  }
};


//steps
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  console.log("username", username);


  //validation check form the inoput field
  if ([fullName, email, username, password].some((field) => !field?.trim())) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const existingUser = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email }],
  });

  if (existingUser) {
    const message =
      existingUser.username === username.toLowerCase()
        ? "Username already exists"
        : "Email already exists";
    return res.status(409).json({ message }); // Send error message for frontend to display
  }

  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toLowerCase(),
    userType: "Admin",
  });

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
      data: {
        user: { fullName, email, username },
        accessToken,
        refreshToken,
      },
      message: "User registered and logged in successfully",
    });
});



const loginUser = asyncHandler(async (req, res, next) => {
  const loginSchema = Joi.object({
    email: Joi.string().email(),
    username: Joi.string(),
    password: Joi.string().required(),
  }).xor("email", "username");

  const { error } = loginSchema.validate(req.body);

  if (error) {
    return next(error);
  }

  const { email,username, password } = req.body;  //username
  // console.log("incoming body", req.body);
  const user = await User.findOne({
    $or: [{ username }, { email }],
    // email,
  });
  // const user = await User.find();
  // return res.json(user);

  if (!user) {
    const error = {
      message: "User does not exist",
      status: "404",
    };
    return next(error);
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    const error = {
      message: "Invalid password, try again!",
      status: "400",
    };
    return next(error);
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  // console.log("accessToken",accessToken);
  // console.log("refreshToken",refreshToken);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken; // Use cookies to retrieve the refresh token

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log('Decoded refresh token:', decoded);

    // Find user by ID
    const user = await User.findById(decoded._id);
    if (!user) {
      console.error('User not found for ID:', decoded._id);
      return res.status(403).json({ message: "User not found" });
    }

    if (user.refreshToken !== refreshToken) {
      console.error('Stored refresh token does not match cookie token');
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Generate new tokens
    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    // Save the new refresh token in the database
    user.refreshToken = newRefreshToken;
    await user.save();


    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY;
    const maxAge = refreshTokenExpiry ? parseInt(refreshTokenExpiry.replace('s', '')) * 1000 : 7 * 24 * 60 * 60 * 1000;


    // Send the new refresh token as an HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true, // Prevent access via JavaScript
      sameSite: "strict", // Protect against CSRF
      maxAge: maxAge, // Use REFRESH_TOKEN_EXPIRY from .env file
    });

    // Send the new access token in the response body
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Error in refreshToken handler:', error);
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }

});

const getUserDetails = asyncHandler(async (req, res) => {

  try {

    const userId = req.user._id;

    // Fetch the user from the database
    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    console.log("from get userdetails", user);
    // Send back user details without sensitive information
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
});

// const jwt = require("jsonwebtoken");

const logoutUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    console.log("userId", userId);

    // Clear the refresh token in the database
    await User.findByIdAndUpdate(
      userId,
      { $unset: { refreshToken: 1 } },
      { new: true }
    );

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    };
    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Invalid or expired refresh token during logout:", error);

    // If the refresh token is expired, we still proceed with logout
    return res
      .status(200)
      .clearCookie("accessToken")
      .clearCookie("refreshToken")
      .json({ message: "User session cleared despite expired refresh token." });
  }
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    username,
    profileImage,
    gender,
    dateofBirth,
    address,
    phoneNumber,
    aboutYou,
  } = req.body;

  try {
    const userId = req.user?._id;

    // Fetch the user from the database
    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Only update the fields that are provided in the request body
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (username) user.username = username;
    if (profileImage) user.profileImage = profileImage;
    if (gender) user.gender = gender;
    if (dateofBirth) user.dateofBirth = dateofBirth;
    if (address) user.address = address;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (aboutYou) user.aboutYou = aboutYou;

    await user.save();
    console.log("from update userdetails", user);

    return res.status(200).json({
      user,
      message: "User details updated successfully",
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
});

const getUserById = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return res.status(500).json({ message: "Error fetching user by ID" });
  }
});


//   if (!refreshToken) {
//     return res.status(401).json({ message: "Refresh token is missing" });
//   }

//   try {
//     // Verify the refresh token
//     const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
//     const userId = decoded._id;

//     // Find and log out the user by clearing the refresh token in the database
//     await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } }, { new: true });
//     console.log("User logged out successfully.");

//     // Clear cookies for access and refresh tokens
//     const options = {
//       httpOnly: true,
//       secure: true,
//       sameSite: "None",
//     };

//     return res
//       .status(200)
//       .clearCookie("accessToken", options)
//       .clearCookie("refreshToken", options)
//       .json({ message: "User logged out successfully" });
//   } catch (error) {
//     console.error("Invalid or expired refresh token during logout:", error);
//     return res.status(403).json({ message: "Invalid or expired refresh token" });
//   }
// });

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export {
  registerUser,
  refreshToken,
  loginUser,
  logoutUser,
  getUserDetails,
  getUserById,
  updateUserDetails,
  refreshAccessToken,
};
