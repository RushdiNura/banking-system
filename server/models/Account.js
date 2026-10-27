import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      unique: true,
      length: [10, "Account number must be 10 digits"],
      validate: {
        validator: (v) => /^\d{10}$/.test(v),
        message: "Account number must be 10 digits",
      },
    },
    accountType: {
      type: String,
      enum: ["savings", "checking", "fixed_deposit", "recurring_deposit"],
      required: [true, "Account type is required"],
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Balance cannot be negative"],
      validate: {
        validator: (v) => {
          // Validate up to 2 decimal places
          return /^\d+(\.\d{1,2})?$/.test(v.toString());
        },
        message: "Balance must have at most 2 decimal places",
      },
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "JPY", "INR"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "frozen", "closed", "pending"],
      default: "active",
    },
    interestRate: {
      type: Number,
      default: 0,
      min: [0, "Interest rate cannot be negative"],
      max: [20, "Interest rate cannot exceed 20%"],
    },
    minimumBalance: {
      type: Number,
      default: 0,
      min: [0, "Minimum balance cannot be negative"],
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: Date,
    lastTransactionAt: Date,
    dailyTransactionLimit: {
      type: Number,
      default: 10000,
      min: [0, "Daily transaction limit cannot be negative"],
    },
    monthlyTransactionLimit: {
      type: Number,
      default: 100000,
      min: [0, "Monthly transaction limit cannot be negative"],
    },
    beneficiaries: [
      {
        beneficiaryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Beneficiary",
        },
        addedAt: Date,
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
accountSchema.index({ userId: 1 });
accountSchema.index({ accountNumber: 1 }, { unique: true });
accountSchema.index({ accountType: 1 });
accountSchema.index({ status: 1 });
accountSchema.index({ balance: 1 });

// Virtual for transactions
accountSchema.virtual("transactions", {
  ref: "Transaction",
  localField: "_id",
  foreignField: "$or",
});

// Generate unique account number
accountSchema.statics.generateAccountNumber = async function () {
  let accountNumber;
  let isUnique = false;

  while (!isUnique) {
    accountNumber = Math.floor(
      1000000000 + Math.random() * 9000000000,
    ).toString();
    const existingAccount = await this.findOne({ accountNumber });
    if (!existingAccount) {
      isUnique = true;
    }
  }

  return accountNumber;
};

// Check if account has sufficient balance
accountSchema.methods.hasSufficientBalance = function (amount) {
  return this.balance >= amount;
};

// Deduct amount from account
accountSchema.methods.deductBalance = async function (amount) {
  if (!this.hasSufficientBalance(amount)) {
    throw new Error("Insufficient balance");
  }

  this.balance -= amount;
  this.lastTransactionAt = new Date();
  await this.save();
  return this.balance;
};

// Add amount to account
accountSchema.methods.addBalance = async function (amount) {
  this.balance += amount;
  this.lastTransactionAt = new Date();
  await this.save();
  return this.balance;
};

// Freeze account
accountSchema.methods.freezeAccount = async function (reason) {
  this.status = "frozen";
  await this.save();
  // Log this action
  console.log(`Account ${this.accountNumber} frozen: ${reason}`);
};

// Close account
accountSchema.methods.closeAccount = async function () {
  if (this.balance > 0) {
    throw new Error("Account must have zero balance before closing");
  }

  this.status = "closed";
  this.closedAt = new Date();
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

export const Account = mongoose.model("Account", accountSchema);
