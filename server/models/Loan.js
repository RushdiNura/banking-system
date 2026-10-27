import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    loanNumber: {
      type: String,
      required: true,
      unique: true,
    },
    loanType: {
      type: String,
      enum: ["personal", "home", "auto", "education", "business", "gold"],
      required: [true, "Loan type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Loan amount is required"],
      min: [1000, "Minimum loan amount is $1,000"],
      max: [1000000, "Maximum loan amount is $1,000,000"],
    },
    interestRate: {
      type: Number,
      required: [true, "Interest rate is required"],
      min: [1, "Minimum interest rate is 1%"],
      max: [30, "Maximum interest rate is 30%"],
    },
    termMonths: {
      type: Number,
      required: [true, "Loan term is required"],
      min: [3, "Minimum loan term is 3 months"],
      max: [360, "Maximum loan term is 360 months (30 years)"],
    },
    emiAmount: {
      type: Number,
      required: true,
    },
    totalInterest: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "disbursed",
        "active",
        "completed",
        "defaulted",
        "cancelled",
      ],
      default: "pending",
    },
    applicationDate: {
      type: Date,
      default: Date.now,
    },
    approvalDate: Date,
    rejectionDate: Date,
    rejectionReason: String,
    disbursementDate: Date,
    nextPaymentDate: Date,
    lastPaymentDate: Date,
    documents: [
      {
        type: {
          type: String,
          enum: [
            "income_proof",
            "id_proof",
            "address_proof",
            "bank_statement",
            "collateral",
          ],
          required: true,
        },
        documentUrl: {
          type: String,
          required: true,
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
    ],
    paymentHistory: [
      {
        paymentId: String,
        amount: Number,
        principal: Number,
        interest: Number,
        paymentDate: Date,
        status: {
          type: String,
          enum: ["completed", "failed", "pending", "late"],
          default: "pending",
        },
        lateFee: Number,
      },
    ],
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    processingFee: {
      type: Number,
      default: 0,
    },
    notes: String,
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
  },
);

// Indexes (unique indexes on loanNumber are already created by `unique: true` in the field)
loanSchema.index({ userId: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ loanType: 1 });
loanSchema.index({ applicationDate: -1 });

// ============ STATICS ============
loanSchema.statics.generateLoanNumber = function () {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `LN${year}${random}`;
};

loanSchema.statics.calculateEMI = function (principal, annualRate, months) {
  const monthlyRate = annualRate / 12 / 100;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(emi * 100) / 100;
};

loanSchema.statics.calculateTotalInterest = function (principal, emi, months) {
  const totalPayment = emi * months;
  return Math.round((totalPayment - principal) * 100) / 100;
};

// ============ MODEL ============
// Register the model BEFORE the hooks reference it, so `Loan` is always defined.
export const Loan = mongoose.model("Loan", loanSchema);

// ============ HOOKS ============
loanSchema.pre("save", function () {
  try {
    if (
      this.isModified("amount") ||
      this.isModified("interestRate") ||
      this.isModified("termMonths")
    ) {
      // Use `this.constructor` — guaranteed to be the Loan model at hook execution time
      this.emiAmount = this.constructor.calculateEMI(
        this.amount,
        this.interestRate,
        this.termMonths,
      );
      this.totalInterest = this.constructor.calculateTotalInterest(
        this.amount,
        this.emiAmount,
        this.termMonths,
      );
      this.totalAmount = this.amount + this.totalInterest;
    }
 
  } catch (err) {
    console.log(error);
  }
});
