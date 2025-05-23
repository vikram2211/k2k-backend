import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

// import jwt from "jsonwebtoken";
// import { User } from "../models/user.js";
// import { ApiError } from "../utils/apiError.js";
// import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    // console.log("verifyJwt - accessToken", accessToken);

    if (!accessToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      // console.log("decodedToken",decodedToken);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        // Access token expired. Attempt to refresh.
        const refreshToken = req.cookies?.refreshToken;
        console.log("refreshToken", refreshToken);
        if (!refreshToken) {
          throw new ApiError(401, "Session expired. Please log in again.");
        }

        const decodedRefreshToken = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );
        console.log("decodedRefreshToken", decodedRefreshToken);

        const user = await User.findById(decodedRefreshToken._id);
        console.log("user", user);

        if (!user || user.refreshToken !== refreshToken) {
          throw new ApiError(401, "Invalid refresh token");
        }

        // Generate new tokens
        const newAccessToken = user.generateAccessToken();
        const newRefreshToken = user.generateRefreshToken();

        // Save new refresh token in the database
        user.refreshToken = newRefreshToken;
        await user.save();

        // Set new tokens in cookies
        res.cookie("accessToken", newAccessToken, {
          // httpOnly: true,
          // secure: process.env.NODE_ENV === "production",
          path: '/',
          secure: false, // Disable Secure for local development
          sameSite: 'Strict',
        });
        res.cookie("refreshToken", newRefreshToken, {
          // httpOnly: true,
          // secure: process.env.NODE_ENV === "production",
          path: '/',
          secure: false, // Disable Secure for local development
          sameSite: 'Strict',
        });

        decodedToken = jwt.verify(newAccessToken, process.env.ACCESS_TOKEN_SECRET);
      } else {
        throw new ApiError(401, "Invalid access token");
      }
    }

    req.user = await User.findById(decodedToken._id).select("-password -refreshToken");
    // console.log("from auth middleware",req.user);
    next();
  } catch (error) {
    throw new ApiError(401, error.message || "Unauthorized");
  }
});
