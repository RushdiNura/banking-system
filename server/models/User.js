import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
      validate: {
        validator: (v) => /^[a-zA-Z\s-']+$/.test(v),
        message:
          "First name can only contain letters, spaces, hyphens and apostrophes",
      },
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
      validate: {
        validator: (v) => /^[a-zA-Z\s-']+$/.test(v),
        message:
          "Last name can only contain letters, spaces, hyphens and apostrophes",
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [
        {
          validator: (v) =>
            /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v),
          message: "Please enter a valid email address",
        },
        {
          // Async validator — only checks uniqueness when the email CHANGED
          async validator(email) {
            // If email wasn't modified, skip the check (user is just updating other fields)
            if (!this.isModified("email")) return true;

            // If email was modified, verify no OTHER user has it
            const existing = await mongoose
              .model("User")
              .findOne({ email, _id: { $ne: this._id } });

            return !existing;
          },
          message: "Email already exists",
        },
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      validate: {
        validator: (v) => /^\+?[\d\s-]{10,15}$/.test(v),
        message: "Please enter a valid phone number",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't return password by default
      validate: {
        validator: (v) => {
          // 8+ chars, 1 uppercase, 1 lowercase, 1 digit, 1 special (any non-alphanumeric)
          const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
          return passwordRegex.test(v);
        },
        message:
          "Password must be at least 8 characters and contain uppercase, lowercase, a number, and a special character",
      },
    },
    role: {
      type: String,
      enum: ["customer", "employee", "admin"],
      default: "customer",
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLogin: Date,
    lastLoginIp: String,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: String,
    profilePicture: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    dateOfBirth: Date,
    occupation: String,
    annualIncome: Number,
    kycStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    kycDocuments: [
      {
        type: {
          type: String,
          enum: ["id_proof", "address_proof", "income_proof"],
        },
        documentUrl: String,
        verified: Boolean,
        verifiedAt: Date,
        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    // Add to the user schema
    profilePicture: {
      publicId: String,
      url: String,
      thumbnail: String,
      uploadedAt: Date,
    },
    documents: [
      {
        type: {
          type: String,
          enum: [
            "id_proof",
            "address_proof",
            "income_proof",
            "signature",
            "other",
          ],
          required: true,
        },
        publicId: String,
        url: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        verified: {
          type: Boolean,
          default: false,
        },
        verifiedAt: Date,
        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();

//   try {
//     const salt = await bcrypt.genSalt(
//       parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
//     );
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(
    parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
  );
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      issuer: "banking-system",
      audience: "banking-users",
    },
  );
  return token;
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
  const token = jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    issuer: "banking-system",
    audience: "banking-users",
  });
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes

  return resetToken;
};

// Generate email verification token
userSchema.methods.generateVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.verificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for accounts
userSchema.virtual("accounts", {
  ref: "Account",
  localField: "_id",
  foreignField: "userId",
});

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  this.loginAttempts = (this.loginAttempts || 0) + 1;

  if (this.loginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
  }

  await this.save({ validateBeforeSave: false });
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockedUntil = undefined;
  await this.save({ validateBeforeSave: false });
};

// Soft delete method
userSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.deletedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

export const User = mongoose.model("User", userSchema);
