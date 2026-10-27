import { Account } from "../models/Account.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { AppError } from "../middleware/errorHandler.js";
import { logger, logAudit } from "../utils/logger.js";
import { redisClient } from "../server.js";

// @desc    Create new account
// @route   POST /api/v1/accounts
// @access  Private (Customer)
export const createAccount = async (req, res, next) => {
  try {
    const { accountType, currency = "USD", initialDeposit = 0 } = req.body;
    const userId = req.user._id;

    // Check KYC status
    if (req.user.kycStatus !== "verified") {
      return res.status(403).json({
        success: false,
        message: "KYC verification required to open an account",
      });
    }

    // Check account limits per user
    const existingAccounts = await Account.countDocuments({
      userId,
      status: { $ne: "closed" },
    });

    const accountLimits = {
      savings: 3,
      checking: 2,
      fixed_deposit: 5,
      recurring_deposit: 5,
    };

    const currentTypeCount = await Account.countDocuments({
      userId,
      accountType,
      status: { $ne: "closed" },
    });

    if (currentTypeCount >= accountLimits[accountType]) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${accountLimits[accountType]} ${accountType} accounts allowed`,
      });
    }

    // Minimum balance requirements
    const minimumBalances = {
      savings: 100,
      checking: 50,
      fixed_deposit: 1000,
      recurring_deposit: 500,
    };

    if (initialDeposit < minimumBalances[accountType]) {
      return res.status(400).json({
        success: false,
        message: `Minimum initial deposit for ${accountType} account is $${minimumBalances[accountType]}`,
      });
    }

    // Generate unique account number
    const accountNumber = await Account.generateAccountNumber();

    // Interest rates by type
    const interestRates = {
      savings: 2.5,
      checking: 0.1,
      fixed_deposit: 5.5,
      recurring_deposit: 4.5,
    };

    // Create account
    const account = await Account.create({
      userId,
      accountNumber,
      accountType,
      balance: initialDeposit,
      currency,
      interestRate: interestRates[accountType],
      minimumBalance: minimumBalances[accountType],
      status: "active",
    });

    // Create initial deposit transaction if applicable
    if (initialDeposit > 0) {
      await Transaction.create({
        transactionId: Transaction.generateTransactionId(),
        referenceNumber: Transaction.generateReferenceNumber(),
        fromAccount: account._id,
        fromAccountNumber: accountNumber,
        type: "deposit",
        amount: initialDeposit,
        currency,
        description: "Initial deposit",
        status: "completed",
        initiatedBy: userId,
        completedAt: new Date(),
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          channel: "web",
        },
      });
    }

    // Log audit
    logAudit({
      action: "ACCOUNT_CREATED",
      userId,
      accountId: account._id,
      accountNumber,
      accountType,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: account,
    });
  } catch (error) {
    logger.error(`Create account error: ${error.message}`);
    next(error);
  }
};

// @desc    Get all accounts for user
// @route   GET /api/v1/accounts
// @access  Private
export const getAccounts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, accountType, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { userId, isDeleted: false };
    if (status) query.status = status;
    if (accountType) query.accountType = accountType;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [accounts, total] = await Promise.all([
      Account.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Account.countDocuments(query),
    ]);

    // Calculate total balance
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    res.status(200).json({
      success: true,
      count: accounts.length,
      total,
      totalBalance,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: accounts,
    });
  } catch (error) {
    logger.error(`Get accounts error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single account
// @route   GET /api/v1/accounts/:id
// @access  Private
export const getAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id).populate(
      "userId",
      "firstName lastName email phone",
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership (unless employee/admin)
    if (
      req.user.role === "customer" &&
      account.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this account",
      });
    }

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    logger.error(`Get account error: ${error.message}`);
    next(error);
  }
};

// @desc    Get account by account number
// @route   GET /api/v1/accounts/number/:accountNumber
// @access  Private
export const getAccountByNumber = async (req, res, next) => {
  try {
    const { accountNumber } = req.params;

    const account = await Account.findOne({
      accountNumber,
      isDeleted: false,
    }).populate("userId", "firstName lastName email");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // For transfers, hide sensitive info
    const responseData = {
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      accountHolderName: account.userId
        ? `${account.userId.firstName} ${account.userId.lastName}`
        : "N/A",
      status: account.status,
      isActive: account.status === "active",
    };

    // Only show balance if it's the user's own account
    if (
      account.userId &&
      account.userId._id.toString() === req.user._id.toString()
    ) {
      responseData.balance = account.balance;
      responseData.currency = account.currency;
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error(`Get account by number error: ${error.message}`);
    next(error);
  }
};

// @desc    Update account
// @route   PUT /api/v1/accounts/:id
// @access  Private
export const updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (
      req.user.role === "customer" &&
      account.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this account",
      });
    }

    // Fields that can be updated
    const allowedUpdates = [
      "accountType",
      "dailyTransactionLimit",
      "monthlyTransactionLimit",
    ];

    // Only admin can update these fields
    if (req.user.role === "admin") {
      allowedUpdates.push("status", "interestRate", "minimumBalance");
    }

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedAccount = await Account.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );

    logAudit({
      action: "ACCOUNT_UPDATED",
      userId: req.user._id,
      accountId: account._id,
      changes: updates,
    });

    res.status(200).json({
      success: true,
      message: "Account updated successfully",
      data: updatedAccount,
    });
  } catch (error) {
    logger.error(`Update account error: ${error.message}`);
    next(error);
  }
};

// @desc    Close account
// @route   DELETE /api/v1/accounts/:id
// @access  Private
export const closeAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (
      req.user.role === "customer" &&
      account.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Check if account has balance
    if (account.balance > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Account must have zero balance before closing. Please withdraw or transfer remaining funds.",
      });
    }

    // Check for pending transactions
    const pendingTransactions = await Transaction.countDocuments({
      $or: [{ fromAccount: account._id }, { toAccount: account._id }],
      status: { $in: ["pending", "processing"] },
    });

    if (pendingTransactions > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot close account with pending transactions",
      });
    }

    // Update account status
    account.status = "closed";
    account.closedAt = new Date();
    account.isDeleted = true;
    account.deletedAt = new Date();
    await account.save();

    logAudit({
      action: "ACCOUNT_CLOSED",
      userId: req.user._id,
      accountId: account._id,
      accountNumber: account.accountNumber,
    });

    res.status(200).json({
      success: true,
      message: "Account closed successfully",
    });
  } catch (error) {
    logger.error(`Close account error: ${error.message}`);
    next(error);
  }
};

// @desc    Get account summary
// @route   GET /api/v1/accounts/:id/summary
// @access  Private
export const getAccountSummary = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (
      req.user.role === "customer" &&
      account.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Get transaction statistics
    const stats = await Transaction.aggregate([
      {
        $match: {
          $or: [{ fromAccount: account._id }, { toAccount: account._id }],
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ["$toAccount", account._id] }, "$amount", 0],
            },
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ["$fromAccount", account._id] }, "$amount", 0],
            },
          },
          transactionCount: { $sum: 1 },
          lastTransaction: { $max: "$createdAt" },
        },
      },
    ]);

    // Get monthly summary
    const monthlySummary = await Transaction.aggregate([
      {
        $match: {
          $or: [{ fromAccount: account._id }, { toAccount: account._id }],
          status: "completed",
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          credits: {
            $sum: {
              $cond: [{ $eq: ["$toAccount", account._id] }, "$amount", 0],
            },
          },
          debits: {
            $sum: {
              $cond: [{ $eq: ["$fromAccount", account._id] }, "$amount", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        account: {
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          balance: account.balance,
          currency: account.currency,
          status: account.status,
        },
        statistics: stats[0] || {
          totalCredits: 0,
          totalDebits: 0,
          transactionCount: 0,
          lastTransaction: null,
        },
        monthlySummary,
      },
    });
  } catch (error) {
    logger.error(`Get account summary error: ${error.message}`);
    next(error);
  }
};

// @desc    Get account statement
// @route   GET /api/v1/accounts/:id/statement
// @access  Private
export const getAccountStatement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      format = "json",
      page = 1,
      limit = 50,
    } = req.query;

    const account = await Account.findById(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (
      req.user.role === "customer" &&
      account.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Build date range
  const dateQuery = {};
if (startDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  dateQuery.$gte = start;
}
if (endDate) {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  dateQuery.$lte = end;
}

    // Build transaction query
    const transactionQuery = {
      $or: [{ fromAccount: account._id }, { toAccount: account._id }],
      status: "completed",
    };

    if (Object.keys(dateQuery).length > 0) {
      transactionQuery.createdAt = dateQuery;
    }

    // Get transactions
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(transactionQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(transactionQuery),
    ]);

    // Calculate opening and closing balance
    const previousBalance = await Transaction.aggregate([
      {
        $match: {
          $or: [{ fromAccount: account._id }, { toAccount: account._id }],
          status: "completed",
          createdAt: { $lt: startDate ? new Date(startDate) : new Date(0) },
        },
      },
      {
        $group: {
          _id: null,
          credits: {
            $sum: {
              $cond: [{ $eq: ["$toAccount", account._id] }, "$amount", 0],
            },
          },
          debits: {
            $sum: {
              $cond: [{ $eq: ["$fromAccount", account._id] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const openingBalance = previousBalance[0]
      ? previousBalance[0].credits - previousBalance[0].debits
      : 0;

    const statement = {
      account: {
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currency: account.currency,
        accountHolder: req.user.firstName + " " + req.user.lastName,
      },
      period: {
        from: startDate || "Beginning",
        to: endDate || new Date().toISOString(),
      },
      openingBalance,
      closingBalance: account.balance,
      transactions: transactions.map((txn) => ({
        date: txn.createdAt,
        transactionId: txn.transactionId,
        referenceNumber: txn.referenceNumber,
        description: txn.description,
        type:
          txn.fromAccount.toString() === account._id.toString()
            ? "debit"
            : "credit",
        amount: txn.amount,
        status: txn.status,
        balance: txn.metadata?.balanceAfter || null,
      })),
      summary: {
        totalTransactions: total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };

    // Generate PDF if requested
    if (format === "pdf") {
      // This would use a PDF library like pdfkit
      // Will implement in the PDF generation section
    }

    res.status(200).json({
      success: true,
      data: statement,
    });
  } catch (error) {
    logger.error(`Get account statement error: ${error.message}`);
    next(error);
  }
};

// @desc    Add beneficiary
// @route   POST /api/v1/accounts/:id/beneficiaries
// @access  Private
export const addBeneficiary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountNumber, nickname, bankName, ifscCode } = req.body;

    const account = await Account.findById(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Verify beneficiary account exists
    const beneficiaryAccount = await Account.findOne({
      accountNumber,
      status: "active",
      isDeleted: false,
    }).populate("userId", "firstName lastName");

    if (!beneficiaryAccount) {
      return res.status(404).json({
        success: false,
        message: "Beneficiary account not found",
      });
    }

    // Check if already added
    const existingBeneficiary = account.beneficiaries.find(
      (b) => b.beneficiaryId?.toString() === beneficiaryAccount._id.toString(),
    );

    if (existingBeneficiary) {
      return res.status(400).json({
        success: false,
        message: "Beneficiary already added",
      });
    }

    // Add beneficiary
    account.beneficiaries.push({
      beneficiaryId: beneficiaryAccount._id,
      addedAt: new Date(),
    });

    await account.save();

    res.status(201).json({
      success: true,
      message: "Beneficiary added successfully",
      data: {
        accountNumber: beneficiaryAccount.accountNumber,
        name: `${beneficiaryAccount.userId.firstName} ${beneficiaryAccount.userId.lastName}`,
        nickname: nickname || null,
      },
    });
  } catch (error) {
    logger.error(`Add beneficiary error: ${error.message}`);
    next(error);
  }
};

// @desc    Get beneficiaries
// @route   GET /api/v1/accounts/:id/beneficiaries
// @access  Private
export const getBeneficiaries = async (req, res, next) => {
  try {
    const { id } = req.params;

    const account = await Account.findById(id).populate({
      path: "beneficiaries.beneficiaryId",
      select: "accountNumber accountType userId",
      populate: {
        path: "userId",
        select: "firstName lastName",
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    const beneficiaries = account.beneficiaries
      .filter((b) => b.beneficiaryId)
      .map((b) => ({
        id: b.beneficiaryId._id,
        accountNumber: b.beneficiaryId.accountNumber,
        accountType: b.beneficiaryId.accountType,
        name: b.beneficiaryId.userId
          ? `${b.beneficiaryId.userId.firstName} ${b.beneficiaryId.userId.lastName}`
          : "N/A",
        addedAt: b.addedAt,
      }));

    res.status(200).json({
      success: true,
      count: beneficiaries.length,
      data: beneficiaries,
    });
  } catch (error) {
    logger.error(`Get beneficiaries error: ${error.message}`);
    next(error);
  }
};

// @desc    Remove beneficiary
// @route   DELETE /api/v1/accounts/:id/beneficiaries/:beneficiaryId
// @access  Private
export const removeBeneficiary = async (req, res, next) => {
  try {
    const { id, beneficiaryId } = req.params;

    const account = await Account.findById(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Check ownership
    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Remove beneficiary
    account.beneficiaries = account.beneficiaries.filter(
      (b) => b.beneficiaryId?.toString() !== beneficiaryId,
    );

    await account.save();

    res.status(200).json({
      success: true,
      message: "Beneficiary removed successfully",
    });
  } catch (error) {
    logger.error(`Remove beneficiary error: ${error.message}`);
    next(error);
  }
};
