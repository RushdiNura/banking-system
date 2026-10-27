import mongoose from "mongoose";
import { Loan } from "../models/Loan.js";
import { Account } from "../models/Account.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { logger, logAudit } from "../utils/logger.js";
import { sendEmail } from "../utils/emailService.js";
import { sendNotificationToUser, sendNotificationToRole } from "../config/socket.js";

// Helper: safe notification (never throws)
const notifyUser = async (userId, notification) => {
  try {
    await sendNotificationToUser(userId.toString(), notification);
  } catch (err) {
    console.error("[NOTIFY] Failed:", err.message);
  }
};

const notifyRole = (role, notification) => {
  try {
    sendNotificationToRole(role, notification);
  } catch (err) {
    console.error("[NOTIFY-ROLE] Failed:", err.message);
  }
};

// @desc    Apply for loan
// @route   POST /api/v1/loans/apply
// @access  Private
export const applyForLoan = async (req, res, next) => {
  try {
    const { loanType, amount, termMonths, purpose, accountId } = req.body;
    const userId = req.user._id;

    if (req.user.kycStatus !== "verified") {
      return res.status(403).json({
        success: false,
        message: "KYC verification required to apply for loans",
      });
    }

    const account = await Account.findOne({
      _id: accountId,
      userId,
      status: "active",
    });

    if (!account) {
      return res.status(400).json({
        success: false,
        message: "Active account required for loan disbursement",
      });
    }

    const existingLoans = await Loan.countDocuments({
      userId,
      status: { $in: ["pending", "approved", "active"] },
    });

    if (existingLoans >= 3) {
      return res.status(400).json({
        success: false,
        message: "Maximum 3 active loans allowed",
      });
    }

    const interestRates = {
      personal: 12.5,
      home: 7.5,
      auto: 9.0,
      education: 8.5,
      business: 14.0,
      gold: 10.5,
    };

    const loanLimits = {
      personal: { min: 1000, max: 50000 },
      home: { min: 10000, max: 1000000 },
      auto: { min: 5000, max: 100000 },
      education: { min: 1000, max: 100000 },
      business: { min: 5000, max: 500000 },
      gold: { min: 1000, max: 200000 },
    };

    const limits = loanLimits[loanType];
    if (amount < limits.min || amount > limits.max) {
      return res.status(400).json({
        success: false,
        message: `Loan amount must be between $${limits.min} and $${limits.max} for ${loanType} loans`,
      });
    }

    const interestRate = interestRates[loanType];
    const emiAmount = Loan.calculateEMI(amount, interestRate, termMonths);
    const totalInterest = Loan.calculateTotalInterest(amount, emiAmount, termMonths);

    const loan = await Loan.create({
      userId,
      loanNumber: Loan.generateLoanNumber(),
      loanType,
      amount,
      interestRate,
      termMonths,
      emiAmount,
      totalInterest,
      totalAmount: amount + totalInterest,
      status: "pending",
      accountId,
      notes: purpose,
      processingFee: Math.round(amount * 0.01 * 100) / 100,
    });

    logAudit({
      action: "LOAN_APPLICATION_SUBMITTED",
      userId,
      loanId: loan._id,
      loanNumber: loan.loanNumber,
      amount,
    });

    // Notify employees and admins of new application
    try {
      const notification = {
        type: "loan",
        variant: "info",
        title: "New Loan Application",
        message: `${req.user.firstName} ${req.user.lastName} applied for a $${amount.toFixed(2)} ${loanType} loan`,
        data: { loanId: loan._id, loanNumber: loan.loanNumber, amount },
        actionUrl: "/dashboard/loans/approvals",
      };
      notifyRole("employee", notification);
      notifyRole("admin", notification);
    } catch (err) {
      console.error("[APPLY] Notification failed:", err.message);
    }

    res.status(201).json({
      success: true,
      message: "Loan application submitted successfully",
      data: loan,
    });
  } catch (error) {
    logger.error(`Apply for loan error: ${error.message}`);
    next(error);
  }
};

// @desc    Get user loans
// @route   GET /api/v1/loans
// @access  Private
export const getLoans = async (req, res, next) => {
  try {
    const { status, loanType, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === "customer") {
      query.userId = req.user._id;
    } else if (req.query.userId) {
      query.userId = req.query.userId;
    }

    if (status) query.status = status;
    if (loanType) query.loanType = loanType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [loans, total] = await Promise.all([
      Loan.find(query)
        .populate("userId", "firstName lastName email")
        .populate("approvedBy", "firstName lastName")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Loan.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: loans.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: loans,
    });
  } catch (error) {
    logger.error(`Get loans error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single loan
// @route   GET /api/v1/loans/:id
// @access  Private
export const getLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate("userId", "firstName lastName email phone")
      .populate("approvedBy", "firstName lastName")
      .populate("accountId", "accountNumber accountType");

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    if (
      req.user.role === "customer" &&
      loan.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    res.status(200).json({
      success: true,
      data: loan,
    });
  } catch (error) {
    logger.error(`Get loan error: ${error.message}`);
    next(error);
  }
};

// @desc    Approve loan
// @route   PUT /api/v1/loans/:id/approve
// @access  Private (Employee/Admin)
export const approveLoan = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const loan = await Loan.findById(req.params.id).session(session);

    if (!loan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    if (loan.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Loan has already been ${loan.status}`,
      });
    }

    loan.status = "approved";
    loan.approvalDate = new Date();
    loan.approvedBy = req.user._id;
    loan.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await loan.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Email notification (existing)
    const user = await User.findById(loan.userId);
    if (user) {
      try {
        await sendEmail({
          email: user.email,
          subject: "Loan Application Approved",
          template: "loanApproved",
          data: {
            name: user.firstName,
            amount: loan.amount,
            loanType: loan.loanType,
            interestRate: loan.interestRate,
            term: loan.termMonths,
            emi: loan.emiAmount,
          },
        });
      } catch (err) {
        console.error("[APPROVE] Email failed:", err.message);
      }
    }

    logAudit({
      action: "LOAN_APPROVED",
      loanId: loan._id,
      loanNumber: loan.loanNumber,
      approvedBy: req.user._id,
    });

    // Real-time notification to customer
    try {
      await sendNotificationToUser(loan.userId.toString(), {
        type: "loan",
        variant: "success",
        title: "Loan Approved! 🎉",
        message: `Your ${loan.loanType} loan of $${loan.amount.toFixed(2)} has been approved`,
        data: { loanId: loan._id, loanNumber: loan.loanNumber, amount: loan.amount },
        actionUrl: `/dashboard/loans/${loan._id}`,
      });
    } catch (err) {
      console.error("[APPROVE] Notification failed:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Loan approved successfully",
      data: loan,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Approve loan error: ${error.message}`);
    next(error);
  }
};

// @desc    Reject loan
// @route   PUT /api/v1/loans/:id/reject
// @access  Private (Employee/Admin)
export const rejectLoan = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }

    if (loan.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Loan has already been ${loan.status}`,
      });
    }

    loan.status = "rejected";
    loan.rejectionDate = new Date();
    loan.rejectionReason = reason;
    loan.approvedBy = req.user._id;

    await loan.save();

    const user = await User.findById(loan.userId);
    if (user) {
      try {
        await sendEmail({
          email: user.email,
          subject: "Loan Application Status",
          template: "loanRejected",
          data: { name: user.firstName, reason },
        });
      } catch (err) {
        console.error("[REJECT] Email failed:", err.message);
      }
    }

    logAudit({
      action: "LOAN_REJECTED",
      loanId: loan._id,
      loanNumber: loan.loanNumber,
      reason,
      rejectedBy: req.user._id,
    });

    // Real-time notification to customer
    try {
      await sendNotificationToUser(loan.userId.toString(), {
        type: "loan",
        variant: "error",
        title: "Loan Application Rejected",
        message: `Your ${loan.loanType} loan application was rejected. Reason: ${reason}`,
        data: { loanId: loan._id, loanNumber: loan.loanNumber },
        actionUrl: `/dashboard/loans/${loan._id}`,
      });
    } catch (err) {
      console.error("[REJECT] Notification failed:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Loan rejected",
      data: loan,
    });
  } catch (error) {
    logger.error(`Reject loan error: ${error.message}`);
    next(error);
  }
};

// @desc    Disburse loan
// @route   POST /api/v1/loans/:id/disburse
// @access  Private (Employee/Admin)
export const disburseLoan = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const loan = await Loan.findById(req.params.id).session(session);

    if (!loan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Loan not found" });
    }

    if (loan.status !== "approved") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Loan must be approved before disbursement",
      });
    }

    const account = await Account.findById(loan.accountId).session(session);

    if (!account || account.status !== "active") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Account not found or inactive",
      });
    }

    const disbursementAmount = loan.amount - (loan.processingFee || 0);

    account.balance += disbursementAmount;
    account.lastTransactionAt = new Date();
    await account.save({ session });

    loan.status = "active";
    loan.disbursementDate = new Date();
    loan.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await loan.save({ session });

    const transactionId = Transaction.generateTransactionId();
    const referenceNumber = Transaction.generateReferenceNumber();

    // NON-ARRAY form — required for Mongoose 8 hook compatibility
    await Transaction.create(
      {
        transactionId,
        referenceNumber,
        toAccount: account._id,
        toAccountNumber: account.accountNumber,
        fromAccount: account._id,
        fromAccountNumber: account.accountNumber,
        type: "loan_disbursement",
        amount: disbursementAmount,
        fee: loan.processingFee || 0,
        totalAmount: loan.amount,
        currency: account.currency,
        description: `Loan disbursement - ${loan.loanNumber}`,
        status: "completed",
        initiatedBy: req.user._id,
        completedAt: new Date(),
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          channel: "system",
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    logAudit({
      action: "LOAN_DISBURSED",
      loanId: loan._id,
      loanNumber: loan.loanNumber,
      amount: disbursementAmount,
      accountId: account._id,
    });

    // Real-time notification
    try {
      await sendNotificationToUser(loan.userId.toString(), {
        type: "transaction",
        variant: "success",
        title: "Loan Disbursed! 💰",
        message: `$${disbursementAmount.toFixed(2)} has been credited to your account ****${account.accountNumber.slice(-4)}`,
        data: {
          loanId: loan._id,
          loanNumber: loan.loanNumber,
          amount: disbursementAmount,
          newBalance: account.balance,
        },
        actionUrl: `/dashboard/accounts/${account._id}`,
      });
    } catch (err) {
      console.error("[DISBURSE] Notification failed:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Loan disbursed successfully",
      data: {
        loan,
        disbursementAmount,
        newBalance: account.balance,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Disburse loan error: ${error.message}`);
    next(error);
  }
};

// @desc    Make loan payment
// @route   POST /api/v1/loans/:id/pay
// @access  Private
export const makeLoanPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { accountId, amount } = req.body;
    const loan = await Loan.findById(req.params.id).session(session);

    if (!loan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Loan not found" });
    }

    if (loan.userId.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (loan.status !== "active") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Loan is not active",
      });
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const account = await Account.findOne({
      _id: accountId,
      userId: req.user._id,
      status: "active",
    }).session(session);

    if (!account) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (account.balance < paymentAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    const monthlyRate = loan.interestRate / 12 / 100;
    const interestComponent = Math.round(loan.amount * monthlyRate * 100) / 100;
    const principalComponent = paymentAmount - interestComponent;

    account.balance -= paymentAmount;
    account.lastTransactionAt = new Date();
    await account.save({ session });

    loan.paymentHistory.push({
      paymentId: Transaction.generateTransactionId(),
      amount: paymentAmount,
      principal: principalComponent,
      interest: interestComponent,
      paymentDate: new Date(),
      status: "completed",
    });

    loan.lastPaymentDate = new Date();

    const totalPaid = loan.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = loan.totalAmount - totalPaid;

    if (remainingAmount <= 0) {
      loan.status = "completed";
      loan.nextPaymentDate = null;
    } else {
      loan.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await loan.save({ session });

    const transactionId = Transaction.generateTransactionId();
    const referenceNumber = Transaction.generateReferenceNumber();

    // CORRECT transaction for loan payment (was 'loan_disbursement' before)
    await Transaction.create(
      {
        transactionId,
        referenceNumber,
        fromAccount: account._id,
        fromAccountNumber: account.accountNumber,
        toAccount: account._id,
        toAccountNumber: account.accountNumber,
        type: "loan_repayment",
        amount: paymentAmount,
        fee: 0,
        totalAmount: paymentAmount,
        currency: account.currency,
        description: `Loan repayment - ${loan.loanNumber}`,
        status: "completed",
        initiatedBy: req.user._id,
        completedAt: new Date(),
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          channel: "system",
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    logAudit({
      action: "LOAN_PAYMENT_MADE",
      loanId: loan._id,
      loanNumber: loan.loanNumber,
      amount: paymentAmount,
      accountId: account._id,
    });

    // Real-time notifications
    try {
      await sendNotificationToUser(loan.userId.toString(), {
        type: "transaction",
        variant: "success",
        title: "Loan Payment Received",
        message: `Payment of $${paymentAmount.toFixed(2)} received for loan ${loan.loanNumber}`,
        data: { loanId: loan._id, remaining: Math.max(0, remainingAmount) },
        actionUrl: `/dashboard/loans/${loan._id}`,
      });

      if (loan.status === "completed") {
        await sendNotificationToUser(loan.userId.toString(), {
          type: "loan",
          variant: "success",
          title: "Loan Completed! 🎊",
          message: `Congratulations! You've fully repaid loan ${loan.loanNumber}`,
          actionUrl: `/dashboard/loans/${loan._id}`,
        });
      }
    } catch (err) {
      console.error("[PAYMENT] Notification failed:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Loan payment successful",
      data: {
        transactionId,
        referenceNumber,
        amountPaid: paymentAmount,
        principalComponent,
        interestComponent,
        remainingAmount: Math.max(0, remainingAmount),
        newBalance: account.balance,
        loanStatus: loan.status,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Loan payment error: ${error.message}`);
    next(error);
  }
};

// @desc    Get EMI schedule
// @route   GET /api/v1/loans/:id/emi-schedule
// @access  Private
export const getEMISchedule = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }

    if (
      req.user.role === "customer" &&
      loan.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const schedule = [];
    let remainingPrincipal = loan.amount;
    const monthlyRate = loan.interestRate / 12 / 100;
    const emi = loan.emiAmount;

    for (let i = 1; i <= loan.termMonths; i++) {
      const interestComponent = Math.round(remainingPrincipal * monthlyRate * 100) / 100;
      const principalComponent = Math.round((emi - interestComponent) * 100) / 100;
      remainingPrincipal = Math.round((remainingPrincipal - principalComponent) * 100) / 100;

      const dueDate = new Date(loan.disbursementDate || loan.applicationDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const isPaid = loan.paymentHistory.some((p, index) => index === i - 1);

      schedule.push({
        installmentNumber: i,
        dueDate,
        emiAmount: emi,
        principalComponent: Math.max(0, principalComponent),
        interestComponent: Math.max(0, interestComponent),
        remainingPrincipal: Math.max(0, remainingPrincipal),
        isPaid: isPaid || false,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        loanNumber: loan.loanNumber,
        amount: loan.amount,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        emiAmount: loan.emiAmount,
        totalInterest: loan.totalInterest,
        totalAmount: loan.totalAmount,
        schedule,
      },
    });
  } catch (error) {
    logger.error(`Get EMI schedule error: ${error.message}`);
    next(error);
  }
};

// @desc    Get all loans (admin/employee)
// @route   GET /api/v1/loans/admin/all
// @access  Private (Employee/Admin)
export const getAllLoans = async (req, res, next) => {
  try {
    const { status, loanType, minAmount, maxAmount, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (loanType) query.loanType = loanType;

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    if (search) {
      query.$or = [{ loanNumber: { $regex: search, $options: "i" } }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [loans, total, stats] = await Promise.all([
      Loan.find(query)
        .populate("userId", "firstName lastName email phone")
        .populate("approvedBy", "firstName lastName")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Loan.countDocuments(query),
      Loan.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      count: loans.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stats,
      data: loans,
    });
  } catch (error) {
    logger.error(`Get all loans error: ${error.message}`);
    next(error);
  }
};

// @desc    Get loan statistics
// @route   GET /api/v1/loans/stats
// @access  Private
export const getLoanStats = async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === "customer") {
      query.userId = req.user._id;
    }

    const stats = await Loan.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalInterest: { $sum: "$totalInterest" },
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    const loansByType = await Loan.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$loanType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const monthlyTrend = await Loan.aggregate([
      { $match: query },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats,
        byType: loansByType,
        monthlyTrend,
      },
    });
  } catch (error) {
    logger.error(`Get loan stats error: ${error.message}`);
    next(error);
  }
};