import { User } from "../models/User.js";
import { Account } from "../models/Account.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";
import { processImage } from "../middleware/uploadMiddleware.js";
import { redisClient } from "../server.js";
import { logger, logSecurityEvent, logAudit } from "../utils/logger.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/emailService.js";

// Helper: is Redis ready?
const redisReady = () => redisClient.isOpen && redisClient.isReady;

// Safe wrapper — silently no-ops if Redis is offline
const safeRedis = async (fn) => {
  if (!redisReady()) return null;
  try {
    return await fn();
  } catch (err) {
    logger.warn(`Redis operation skipped: ${err.message}`);
    return null;
  }
};

// @desc    Register user
export const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      address,
    } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password,
      dateOfBirth,
      address,
      role: "customer",
      isVerified: true, // ← auto-verified, no email step
    });
    const verificationToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Email is best-effort — don't fail registration if SMTP is down
    try {
      await sendEmail({
        email: user.email,
        subject: "Verify Your Email",
        template: "verification",
        data: {
          name: user.firstName,
          verificationUrl,
          appName: process.env.APP_NAME || "Banking System",
        },
      });
    } catch (err) {
      logger.warn(`Verification email failed: ${err.message}`);
    }

    logAudit({
      action: "USER_REGISTERED",
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Store refresh token — only if Redis available
    await safeRedis(() =>
      redisClient.set(`refresh:${user._id}`, refreshToken, {
        EX: 30 * 24 * 60 * 60,
      }),
    );

    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error(`Register error: ${error.message}`);
    next(error);
  }
};

// @desc    Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil - Date.now()) / 1000 / 60,
      );
      return res.status(423).json({
        success: false,
        message: `Account is locked. Try again in ${remainingMinutes} minutes`,
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account has been deactivated. Contact support.",
      });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      await user.incrementLoginAttempts();
      logSecurityEvent({
        event: "FAILED_LOGIN",
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Email verification check removed — login always proceeds

    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    await safeRedis(() =>
      redisClient.set(`refresh:${user._id}`, refreshToken, {
        EX: 30 * 24 * 60 * 60,
      }),
    );

    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    await user.save({ validateBeforeSave: false });

    logAudit({
      action: "USER_LOGGED_IN",
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
          kycStatus: user.kycStatus,
          profilePicture: user.profilePicture,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

// @desc    Refresh token
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Verify against stored token — but only if Redis is up
    if (redisReady()) {
      const storedToken = await safeRedis(() =>
        redisClient.get(`refresh:${decoded.id}`),
      );
      if (storedToken && storedToken !== refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    const newToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    await safeRedis(() =>
      redisClient.set(`refresh:${user._id}`, newRefreshToken, {
        EX: 30 * 24 * 60 * 60,
      }),
    );

    res.status(200).json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error(`Refresh token error: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

// @desc    Logout user
export const logout = async (req, res, next) => {
  try {
    const token = req.token;
    const userId = req.user._id;

    await safeRedis(async () => {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.set(`blacklist:${token}`, "1", { EX: ttl });
      }
      await redisClient.del(`refresh:${userId}`);
    });

    res.clearCookie("refreshToken");

    logAudit({
      action: "USER_LOGGED_OUT",
      userId,
      email: req.user.email,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(error);
  }
};

// @desc    Verify email
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logAudit({
      action: "EMAIL_VERIFIED",
      userId: user._id,
      email: user.email,
    });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    logger.error(`Verify email error: ${error.message}`);
    next(error);
  }
};

// @desc    Forgot password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset Request",
        template: "passwordReset",
        data: {
          name: user.firstName,
          resetUrl,
          appName: process.env.APP_NAME,
        },
      });
    } catch (err) {
      logger.warn(`Reset email failed: ${err.message}`);
    }

    logSecurityEvent({
      event: "PASSWORD_RESET_REQUESTED",
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);
    next(error);
  }
};

// @desc    Reset password
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logSecurityEvent({
      event: "PASSWORD_RESET",
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset Successful",
        template: "passwordResetSuccess",
        data: { name: user.firstName, appName: process.env.APP_NAME },
      });
    } catch (err) {
      logger.warn(`Reset confirmation email failed: ${err.message}`);
    }

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    next(error);
  }
};

// @desc    Get current user
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("accounts", "accountNumber accountType balance status currency")
      .select("-password");

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Get me error: ${error.message}`);
    next(error);
  }
};

// @desc    Update profile
export const updateProfile = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      occupation,
      annualIncome,
      address,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (occupation) user.occupation = occupation;
    if (annualIncome) user.annualIncome = annualIncome;
    if (address) user.address = { ...user.address, ...address };

    await user.save();

    logAudit({
      action: "PROFILE_UPDATED",
      userId: user._id,
      email: user.email,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    next(error);
  }
};

// @desc    Upload profile picture
export const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file",
      });
    }

    const user = await User.findById(req.user._id);

    const processedImage = await processImage(req.file.buffer, {
      width: 500,
      height: 500,
      format: "webp",
      quality: 80,
    });

    const result = await uploadToCloudinary(processedImage, "profile");

    if (user.profilePicture?.publicId) {
      await deleteFromCloudinary(user.profilePicture.publicId);
    }

    user.profilePicture = {
      publicId: result.publicId,
      url: result.url,
      uploadedAt: new Date(),
    };

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: { profilePicture: user.profilePicture },
    });
  } catch (error) {
    logger.error(`Upload profile picture error: ${error.message}`);
    next(error);
  }
};

// @desc    Change password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    await safeRedis(async () => {
      const refreshToken = await redisClient.get(`refresh:${req.user._id}`);
      if (refreshToken) {
        await redisClient.set(`blacklist:${refreshToken}`, "1", {
          EX: 30 * 24 * 60 * 60,
        });
      }
      await redisClient.del(`refresh:${req.user._id}`);
    });

    logSecurityEvent({
      event: "PASSWORD_CHANGED",
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);
    next(error);
  }
};

// @desc    Upload KYC documents
// @desc    Upload KYC documents
// @route   POST /api/v1/auth/kyc
// @access  Private
export const uploadKYC = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload KYC documents",
      });
    }

    const user = await User.findById(req.user._id);

    // Parse documentTypes — comes as JSON string from FormData
    let documentTypes = [];
    try {
      const raw = req.body.documentTypes;
      if (typeof raw === "string") {
        documentTypes = JSON.parse(raw);
      } else if (Array.isArray(raw)) {
        documentTypes = raw;
      }
    } catch (err) {
      logger.warn(`Failed to parse documentTypes: ${err.message}`);
      documentTypes = [];
    }

    // Validate the parsed array
    if (!Array.isArray(documentTypes)) {
      documentTypes = [];
    }

    const uploadedDocuments = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docType = documentTypes[i] || "other";

      // Validate docType is a valid enum value
      const validTypes = [
        "id_proof",
        "address_proof",
        "income_proof",
        "signature",
        "other",
      ];
      const safeType = validTypes.includes(docType) ? docType : "other";

      const result = await uploadToCloudinary(file, "kyc");

      uploadedDocuments.push({
        type: safeType,
        publicId: result.publicId,
        url: result.url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    user.documents = [...user.documents, ...uploadedDocuments];
    user.kycStatus = "pending";
    await user.save();

    logAudit({
      action: "KYC_DOCUMENTS_UPLOADED",
      userId: user._id,
      email: user.email,
      documentCount: uploadedDocuments.length,
    });

    res.status(200).json({
      success: true,
      message: "KYC documents uploaded successfully",
      data: {
        documents: uploadedDocuments,
        kycStatus: user.kycStatus,
      },
    });
  } catch (error) {
    logger.error(`Upload KYC error: ${error.message}`);
    next(error);
  }
};
