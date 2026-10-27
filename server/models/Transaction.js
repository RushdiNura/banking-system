import mongoose from "mongoose";
import crypto from "crypto";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Source account is required"],
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    fromAccountNumber: {
      type: String,
      required: true,
    },
    toAccountNumber: {
      type: String,
    },
    type: {
      type: String,
      enum: [
        "deposit",
        "withdrawal",
        "transfer",
        "payment",
        "interest",
        "fee",
        "loan_disbursement",
        "loan_repayment",
        "refund",
        "adjustment",
      ],
      required: [true, "Transaction type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Transaction amount is required"],
      min: [0.01, "Amount must be greater than 0"],
      validate: {
        validator: (v) => {
          // Validate up to 2 decimal places
          return /^\d+(\.\d{1,2})?$/.test(v.toString());
        },
        message: "Amount must have at most 2 decimal places",
      },
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "JPY", "INR"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "reversed",
      ],
      default: "pending",
    },
    referenceNumber: {
      type: String,
      unique: true,
    },
    fee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      location: String,
      device: String,
     channel: {
  type: String,
  enum: ['web', 'mobile', 'api', 'atm', 'branch', 'system'],
  default: 'web',
},
    },
    beneficiaryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beneficiary",
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvalDate: Date,
    reversalReason: String,
    reversedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    scheduledFor: Date,
    completedAt: Date,
    failedAt: Date,
    failureReason: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
transactionSchema.index({ transactionId: 1 }, { unique: true });
transactionSchema.index({ fromAccount: 1 });
transactionSchema.index({ toAccount: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ fromAccountNumber: 1 });
transactionSchema.index({ toAccountNumber: 1 });
transactionSchema.index({ referenceNumber: 1 });

// Generate unique transaction ID
transactionSchema.statics.generateTransactionId = function () {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TXN${timestamp}${random}`;
};

// Generate reference number
transactionSchema.statics.generateReferenceNumber = function () {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `REF${timestamp}${random}`;
};

// Calculate total amount (amount + fee)
transactionSchema.pre("save", function () {
  if (this.isModified("amount") || this.isModified("fee")) {
    this.totalAmount = this.amount + (this.fee || 0);
  }
 
});

// Reverse transaction
transactionSchema.methods.reverse = async function (reason) {
  this.status = "reversed";
  this.reversalReason = reason;
  await this.save();
};

export const Transaction = mongoose.model("Transaction", transactionSchema);
