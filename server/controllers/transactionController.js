import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";
import { Account } from "../models/Account.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  logger,
  logTransaction,
  logAudit,
  logSecurityEvent,
} from "../utils/logger.js";
import { redisClient } from "../server.js";
import { sendEmail } from "../utils/emailService.js";

// @desc    Transfer funds between accounts
// @route   POST /api/v1/transactions/transfer
// @access  Private
export const transferFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fromAccountId,
      toAccountNumber,
      amount,
      description,
      saveBeneficiary = false,
    } = req.body;

    const userId = req.user._id;
    const transferAmount = parseFloat(amount);

    // Validate amount
    if (!transferAmount || transferAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid transfer amount",
      });
    }

    // Idempotency check (safe — only if Redis is available)
    const idempotencyKey = req.headers["idempotency-key"];
    const redisReady = redisClient.isOpen && redisClient.isReady;

    if (idempotencyKey && redisReady) {
      try {
        const existingKey = await redisClient.get(
          `idempotency:${idempotencyKey}`,
        );
        if (existingKey) {
          await session.abortTransaction();
          session.endSession();
          return res.status(200).json({
            success: true,
            message: "Transaction already processed",
            data: JSON.parse(existingKey),
          });
        }
      } catch (err) {
        logger.warn(`Idempotency check skipped: ${err.message}`);
      }
    }

    // Get source account
    const fromAccount = await Account.findOne({
      _id: fromAccountId,
      userId,
      status: "active",
      isDeleted: false,
    }).session(session);

    if (!fromAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Source account not found or inactive",
      });
    }

    if (
      req.user.role === "customer" &&
      fromAccount.userId.toString() !== userId.toString()
    ) {
      await session.abortTransaction();
      session.endSession();

      logSecurityEvent({
        event: "UNAUTHORIZED_TRANSFER_ATTEMPT",
        userId,
        accountId: fromAccountId,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: "Not authorized to transfer from this account",
      });
    }

    // Get destination account
    const toAccount = await Account.findOne({
      accountNumber: toAccountNumber,
      status: "active",
      isDeleted: false,
    }).session(session);

    if (!toAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Destination account not found or inactive",
      });
    }

    // Prevent self-transfer
    if (fromAccount._id.toString() === toAccount._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to the same account",
      });
    }

    // Fee calculation
    const isInternalTransfer =
      fromAccount.userId.toString() === toAccount.userId.toString();
    const transferFee = isInternalTransfer
      ? 0
      : Math.round(transferAmount * 0.001 * 100) / 100;
    const totalDeduction = transferAmount + transferFee;

    // Balance check
    if (fromAccount.balance < totalDeduction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Required: $${totalDeduction.toFixed(2)}, Available: $${fromAccount.balance.toFixed(2)}`,
      });
    }

    // Daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTransfers = await Transaction.aggregate([
      {
        $match: {
          fromAccount: fromAccount._id,
          type: "transfer",
          status: "completed",
          createdAt: { $gte: todayStart },
        },
      },
      {
        $group: { _id: null, total: { $sum: "$amount" } },
      },
    ]).session(session);

    const todayTotal = todayTransfers[0]?.total || 0;
    if (todayTotal + transferAmount > fromAccount.dailyTransactionLimit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Daily transaction limit exceeded. Limit: $${fromAccount.dailyTransactionLimit}, Used today: $${todayTotal}`,
      });
    }

    // Monthly limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyTransfers = await Transaction.aggregate([
      {
        $match: {
          fromAccount: fromAccount._id,
          type: "transfer",
          status: "completed",
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: { _id: null, total: { $sum: "$amount" } },
      },
    ]).session(session);

    const monthlyTotal = monthlyTransfers[0]?.total || 0;
    if (monthlyTotal + transferAmount > fromAccount.monthlyTransactionLimit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Monthly transaction limit exceeded. Limit: $${fromAccount.monthlyTransactionLimit}, Used this month: $${monthlyTotal}`,
      });
    }

    // Generate IDs
    const transactionId = Transaction.generateTransactionId();
    const referenceNumber = Transaction.generateReferenceNumber();

    // Deduct / credit
    fromAccount.balance -= totalDeduction;
    fromAccount.lastTransactionAt = new Date();
    await fromAccount.save({ session });

    toAccount.balance += transferAmount;
    toAccount.lastTransactionAt = new Date();
    await toAccount.save({ session });

    // Create transaction record
    const [transaction] = await Transaction.create(
      [
        {
          transactionId,
          referenceNumber,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          type: "transfer",
          amount: transferAmount,
          fee: transferFee,
          totalAmount: totalDeduction,
          currency: fromAccount.currency,
          description: description || "Fund transfer",
          status: "completed",
          initiatedBy: userId,
          completedAt: new Date(),
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            channel: "web",
          },
        },
      ],
      { session },
    );

    // Save beneficiary if requested
    if (saveBeneficiary) {
      const exists = fromAccount.beneficiaries.some(
        (b) => b.beneficiaryId?.toString() === toAccount._id.toString(),
      );
      if (!exists) {
        fromAccount.beneficiaries.push({
          beneficiaryId: toAccount._id,
          addedAt: new Date(),
        });
        await fromAccount.save({ session });
      }
    }

    // Commit
    await session.commitTransaction();
    session.endSession();

    // Cache idempotency key (if Redis available)
    if (idempotencyKey && redisReady) {
      try {
        await redisClient.set(
          `idempotency:${idempotencyKey}`,
          JSON.stringify({
            transactionId,
            referenceNumber,
            amount: transferAmount,
            fee: transferFee,
          }),
          { EX: 24 * 60 * 60 },
        );
      } catch (err) {
        logger.warn(`Idempotency cache skipped: ${err.message}`);
      }
    }

    logTransaction({
      transactionId,
      type: "transfer",
      fromAccount: fromAccount.accountNumber,
      toAccount: toAccount.accountNumber,
      amount: transferAmount,
      fee: transferFee,
      userId,
    });

    // Send notifications (best-effort)
    try {
      const { sendNotificationToUser } = await import("../config/socket.js");

      await sendNotificationToUser(fromAccount.userId.toString(), {
        type: "transaction",
        variant: "success",
        title: "Transfer Successful",
        message: `You sent $${transferAmount.toFixed(2)} to ****${toAccount.accountNumber.slice(-4)}`,
        data: {
          transactionId,
          amount: transferAmount,
          toAccountNumber: toAccount.accountNumber,
          newBalance: fromAccount.balance,
        },
        actionUrl: `/dashboard/transactions?id=${transaction._id}`,
      });

      await sendNotificationToUser(toAccount.userId.toString(), {
        type: "transaction",
        variant: "success",
        title: "Funds Received",
        message: `You received $${transferAmount.toFixed(2)} from ****${fromAccount.accountNumber.slice(-4)}`,
        data: {
          transactionId,
          amount: transferAmount,
          fromAccountNumber: fromAccount.accountNumber,
          newBalance: toAccount.balance,
        },
        actionUrl: `/dashboard/transactions?id=${transaction._id}`,
      });
    } catch (err) {
      logger.warn(`Notification skipped: ${err.message}`);
    }

    res.status(200).json({
      success: true,
      message: "Transfer completed successfully",
      data: {
        transactionId,
        referenceNumber,
        amount: transferAmount,
        fee: transferFee,
        totalDeducted: totalDeduction,
        newBalance: fromAccount.balance,
        recipient: {
          accountNumber: toAccount.accountNumber,
          name: toAccount.userId
            ? `${toAccount.userId.firstName} ${toAccount.userId.lastName}`
            : "N/A",
        },
        status: "completed",
        timestamp: transaction.createdAt,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Transfer funds error: ${error.message}`);
    next(error);
  }
};

// @desc    Deposit funds
// @route   POST /api/v1/transactions/deposit
// @access  Private (Employee/Admin)
export const depositFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { accountId, amount, description, channel = "branch" } = req.body;

    const depositAmount = parseFloat(amount);

    if (!depositAmount || depositAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid deposit amount",
      });
    }

    // Get account
    const account = await Account.findOne({
      _id: accountId,
      status: "active",
      isDeleted: false,
    }).session(session);

    if (!account) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Account not found or inactive",
      });
    }

    // Add to balance
    account.balance += depositAmount;
    account.lastTransactionAt = new Date();
    await account.save({ session });

    // Create transaction
    const transactionId = Transaction.generateTransactionId();
    const referenceNumber = Transaction.generateReferenceNumber();

    const [transaction] = await Transaction.create(
      [
        {
          transactionId,
          referenceNumber,
          fromAccount: account._id, // For deposit, fromAccount = toAccount
          toAccount: account._id,
          fromAccountNumber: account.accountNumber,
          toAccountNumber: account.accountNumber,
          type: "deposit",
          amount: depositAmount,
          currency: account.currency,
          description: description || "Cash deposit",
          status: "completed",
          initiatedBy: req.user._id,
          completedAt: new Date(),
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            channel,
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    logTransaction({
      transactionId,
      type: "deposit",
      accountNumber: account.accountNumber,
      amount: depositAmount,
      processedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Deposit successful",
      data: {
        transactionId,
        referenceNumber,
        amount: depositAmount,
        newBalance: account.balance,
        status: "completed",
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Deposit funds error: ${error.message}`);
    next(error);
  }
};

// @desc    Withdraw funds
// @route   POST /api/v1/transactions/withdraw
// @access  Private
export const withdrawFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { accountId, amount, description, channel = "atm" } = req.body;

    const withdrawAmount = parseFloat(amount);

    if (!withdrawAmount || withdrawAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal amount",
      });
    }

    // Get account
    const account = await Account.findOne({
      _id: accountId,
      status: "active",
      isDeleted: false,
    }).session(session);

    if (!account) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Account not found or inactive",
      });
    }

    // Check ownership for customers
    if (
      req.user.role === "customer" &&
      account.userId.toString() !== req.user._id.toString()
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Check minimum balance
    if (account.balance - withdrawAmount < account.minimumBalance) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Withdrawal would breach minimum balance of $${account.minimumBalance}`,
      });
    }

    // Withdrawal fee (0.05% for ATM withdrawals over $1000)
    const withdrawalFee =
      channel === "atm" && withdrawAmount > 1000
        ? Math.round(withdrawAmount * 0.0005 * 100) / 100
        : 0;

    if (account.balance < withdrawAmount + withdrawalFee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Deduct from balance
    account.balance -= withdrawAmount + withdrawalFee;
    account.lastTransactionAt = new Date();
    await account.save({ session });

    // Create transaction
    const transactionId = Transaction.generateTransactionId();
    const referenceNumber = Transaction.generateReferenceNumber();

    await Transaction.create(
      [
        {
          transactionId,
          referenceNumber,
          fromAccount: account._id,
          fromAccountNumber: account.accountNumber,
          type: "withdrawal",
          amount: withdrawAmount,
          fee: withdrawalFee,
          totalAmount: withdrawAmount + withdrawalFee,
          currency: account.currency,
          description: description || "Cash withdrawal",
          status: "completed",
          initiatedBy: req.user._id,
          completedAt: new Date(),
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            channel,
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    logTransaction({
      transactionId,
      type: "withdrawal",
      accountNumber: account.accountNumber,
      amount: withdrawAmount,
      fee: withdrawalFee,
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal successful",
      data: {
        transactionId,
        referenceNumber,
        amount: withdrawAmount,
        fee: withdrawalFee,
        totalDeducted: withdrawAmount + withdrawalFee,
        newBalance: account.balance,
        status: "completed",
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Withdraw funds error: ${error.message}`);
    next(error);
  }
};

// @desc    Get transaction history
// @route   GET /api/v1/transactions
// @access  Private
export const getTransactions = async (req, res, next) => {
  try {
    const {
      accountId,
      type,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    // Build query
    const query = {};

    // For customers, only show their transactions
    if (req.user.role === "customer") {
      const userAccounts = await Account.find({
        userId: req.user._id,
      }).select("_id");

      const accountIds = userAccounts.map((a) => a._id);

      query.$or = [
        { fromAccount: { $in: accountIds } },
        { toAccount: { $in: accountIds } },
      ];

      if (accountId) {
        if (!accountIds.map((id) => id.toString()).includes(accountId)) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to view this account",
          });
        }
        query.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
      }
    } else if (accountId) {
      query.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
    }

    // Filter by type
    if (type) query.type = type;
    if (status) query.status = status;

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Filter by amount
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    // Search in description, transactionId, referenceNumber
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { description: { $regex: search, $options: "i" } },
          { transactionId: { $regex: search, $options: "i" } },
          { referenceNumber: { $regex: search, $options: "i" } },
        ],
      });
    }

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("fromAccount", "accountNumber accountType")
        .populate("toAccount", "accountNumber accountType")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query),
    ]);

    // Calculate summary
    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalFees: { $sum: "$fee" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      summary: summary[0] || { totalAmount: 0, totalFees: 0, count: 0 },
      data: transactions,
    });
  } catch (error) {
    logger.error(`Get transactions error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single transaction
// @route   GET /api/v1/transactions/:id
// @access  Private
export const getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("fromAccount", "accountNumber accountType userId")
      .populate("toAccount", "accountNumber accountType userId")
      .populate("initiatedBy", "firstName lastName email");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Check authorization
    if (req.user.role === "customer") {
      const userAccounts = await Account.find({
        userId: req.user._id,
      }).select("_id");

      const accountIds = userAccounts.map((a) => a._id.toString());
      const isInvolved =
        accountIds.includes(transaction.fromAccount?._id.toString()) ||
        accountIds.includes(transaction.toAccount?._id.toString());

      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this transaction",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    logger.error(`Get transaction error: ${error.message}`);
    next(error);
  }
};

// @desc    Reverse transaction
// @route   POST /api/v1/transactions/:id/reverse
// @access  Private (Employee/Admin)
export const reverseTransaction = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;

    const originalTransaction = await Transaction.findById(
      req.params.id,
    ).session(session);

    if (!originalTransaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Check if transaction can be reversed
    if (originalTransaction.status !== "completed") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only completed transactions can be reversed",
      });
    }

    // Check if already reversed
    const existingReversal = await Transaction.findOne({
      reversedFrom: originalTransaction._id,
      status: "completed",
    }).session(session);

    if (existingReversal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Transaction already reversed",
      });
    }

    // Check reversal time limit (7 days)
    const daysSinceTransaction =
      (Date.now() - originalTransaction.createdAt.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysSinceTransaction > 7) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Transaction cannot be reversed after 7 days",
      });
    }

    const amount = originalTransaction.amount;
    const fee = originalTransaction.fee || 0;
    const totalAmount = amount + fee;

    // Get accounts
    const fromAccount = await Account.findById(
      originalTransaction.fromAccount,
    ).session(session);
    const toAccount = originalTransaction.toAccount
      ? await Account.findById(originalTransaction.toAccount).session(session)
      : null;

    if (!fromAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Source account not found",
      });
    }

    // Check if destination account still has funds
    if (toAccount && toAccount.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance in destination account to reverse",
      });
    }

    // Reverse the amounts
    fromAccount.balance += totalAmount;
    fromAccount.lastTransactionAt = new Date();
    await fromAccount.save({ session });

    if (toAccount) {
      toAccount.balance -= amount;
      toAccount.lastTransactionAt = new Date();
      await toAccount.save({ session });
    }

    // Mark original as reversed
    originalTransaction.status = "reversed";
    originalTransaction.reversalReason = reason;
    await originalTransaction.save({ session });

    // Create reversal transaction
    const transactionId = Transaction.generateTransactionId();
    const referenceNumber = Transaction.generateReferenceNumber();

    await Transaction.create(
      [
        {
          transactionId,
          referenceNumber,
          fromAccount: toAccount?._id || fromAccount._id,
          toAccount: fromAccount._id,
          fromAccountNumber:
            toAccount?.accountNumber || fromAccount.accountNumber,
          toAccountNumber: fromAccount.accountNumber,
          type: "refund",
          amount,
          fee: 0,
          totalAmount: amount,
          currency: originalTransaction.currency,
          description: `Reversal of ${originalTransaction.transactionId}: ${reason}`,
          status: "completed",
          initiatedBy: req.user._id,
          reversedFrom: originalTransaction._id,
          completedAt: new Date(),
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            channel: "web",
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    logAudit({
      action: "TRANSACTION_REVERSED",
      originalTransactionId: originalTransaction._id,
      transactionId,
      reason,
      performedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Transaction reversed successfully",
      data: {
        transactionId,
        referenceNumber,
        originalTransaction: originalTransaction.transactionId,
        amount,
        reason,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Reverse transaction error: ${error.message}`);
    next(error);
  }
};

// @desc    Get transaction statistics
// @route   GET /api/v1/transactions/stats
// @access  Private
export const getTransactionStats = async (req, res, next) => {
  try {
    const { accountId, period = "30d" } = req.query;

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case "7d":
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build match query
    const matchQuery = {
      status: "completed",
      createdAt: { $gte: dateFilter },
    };

    if (req.user.role === "customer") {
      const userAccounts = await Account.find({
        userId: req.user._id,
      }).select("_id");

      const accountIds = userAccounts.map((a) => a._id);

      if (accountId) {
        matchQuery.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
      } else {
        matchQuery.$or = [
          { fromAccount: { $in: accountIds } },
          { toAccount: { $in: accountIds } },
        ];
      }
    } else if (accountId) {
      matchQuery.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
    }

    // Get stats by type
    const statsByType = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          maxAmount: { $max: "$amount" },
          minAmount: { $min: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Get daily trend
    const dailyTrend = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
          },
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          transactions: {
            $push: {
              type: "$_id.type",
              count: "$count",
              amount: "$amount",
            },
          },
          totalCount: { $sum: "$count" },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top recipients/senders
    const topRecipients = await Transaction.aggregate([
      {
        $match: {
          ...matchQuery,
          type: "transfer",
        },
      },
      {
        $group: {
          _id: "$toAccount",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: "$account" },
      {
        $project: {
          accountNumber: "$account.accountNumber",
          count: 1,
          totalAmount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        statsByType,
        dailyTrend,
        topRecipients,
      },
    });
  } catch (error) {
    logger.error(`Get transaction stats error: ${error.message}`);
    next(error);
  }
};

// Helper function to send transfer notifications
const sendTransferNotifications = async (
  fromAccount,
  toAccount,
  transaction,
) => {
  try {
    // Get user details
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromAccount.userId),
      User.findById(toAccount.userId),
    ]);

    if (!fromUser || !toUser) return;

    const amount = transaction.amount.toFixed(2);

    // Send to sender
    await sendEmail({
      email: fromUser.email,
      subject: "Transfer Successful",
      template: "transferSent",
      data: {
        name: fromUser.firstName,
        amount,
        recipientAccount: toAccount.accountNumber,
        recipientName: `${toUser.firstName} ${toUser.lastName}`,
        transactionId: transaction.transactionId,
        newBalance: fromAccount.balance.toFixed(2),
        date: new Date().toLocaleString(),
      },
    });

    // Send to recipient
    await sendEmail({
      email: toUser.email,
      subject: "Funds Received",
      template: "transferReceived",
      data: {
        name: toUser.firstName,
        amount,
        senderAccount: fromAccount.accountNumber,
        senderName: `${fromUser.firstName} ${fromUser.lastName}`,
        transactionId: transaction.transactionId,
        newBalance: toAccount.balance.toFixed(2),
        date: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    logger.error(`Notification sending error: ${error.message}`);
  }
};
