import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { Loan } from '../models/Loan.js';
import { User } from '../models/User.js';
import {
  generateCSV,
  setCSVHeaders,
  formatCurrencyCSV,
  formatDateCSV,
  formatDateTimeCSV,
} from '../utils/csvGenerator.js';
import { logger, logAudit } from '../utils/logger.js';

// Helper: apply date filter with proper start/end of day
const applyDateFilter = (query, startDate, endDate, field = 'createdAt') => {
  if (!startDate && !endDate) return;
  query[field] = {};
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    query[field].$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query[field].$lte = end;
  }
};

export const exportTransactions = async (req, res, next) => {
  try {
    const { accountId, type, status, startDate, endDate, minAmount, maxAmount, search } = req.query;

    const query = {};

    if (req.user.role === 'customer') {
      const userAccounts = await Account.find({ userId: req.user._id }).select('_id');
      const accountIds = userAccounts.map((a) => a._id);

      if (accountId) {
        if (!accountIds.map((id) => id.toString()).includes(accountId)) {
          return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        query.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
      } else {
        query.$or = [
          { fromAccount: { $in: accountIds } },
          { toAccount: { $in: accountIds } },
        ];
      }
    } else if (accountId) {
      query.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
    }

    if (type) query.type = type;
    if (status) query.status = status;

    applyDateFilter(query, startDate, endDate);

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { description: { $regex: search, $options: 'i' } },
          { transactionId: { $regex: search, $options: 'i' } },
          { referenceNumber: { $regex: search, $options: 'i' } },
        ],
      });
    }

    console.log('[EXPORT] Query:', JSON.stringify(query, null, 2));

    const transactions = await Transaction.find(query)
      .populate('fromAccount', 'accountNumber')
      .populate('toAccount', 'accountNumber')
      .sort('-createdAt')
      .limit(100000)
      .lean();

    console.log('[EXPORT] Found', transactions.length, 'transactions');

    const columns = [
      { key: 'transactionId', label: 'Transaction ID' },
      { key: 'referenceNumber', label: 'Reference' },
      { key: 'createdAt', label: 'Date', formatter: formatDateTimeCSV },
      { key: 'type', label: 'Type' },
      { key: 'fromAccountNumber', label: 'From Account' },
      { key: 'toAccountNumber', label: 'To Account' },
      { key: 'amount', label: 'Amount', formatter: (v) => Number(v || 0).toFixed(2) },
      { key: 'fee', label: 'Fee', formatter: (v) => Number(v || 0).toFixed(2) },
      { key: 'currency', label: 'Currency' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status' },
    ];

    const csv = generateCSV(transactions, columns);
    setCSVHeaders(res, `transactions-${Date.now()}.csv`);

    logAudit({
      action: 'CSV_EXPORT',
      resource: 'transactions',
      userId: req.user._id,
      count: transactions.length,
    });

    res.send(csv);
  } catch (error) {
    logger.error(`Export transactions error: ${error.message}`);
    next(error);
  }
};

export const exportAccounts = async (req, res, next) => {
  try {
    const { status, accountType, currency } = req.query;
    const query = { isDeleted: false };
    if (req.user.role === 'customer') query.userId = req.user._id;
    if (status) query.status = status;
    if (accountType) query.accountType = accountType;
    if (currency) query.currency = currency;

    const accounts = await Account.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort('-createdAt')
      .limit(100000)
      .lean();

    const columns = [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'accountType', label: 'Account Type' },
      { key: 'user', label: 'Account Holder', formatter: (_, row) => row.userId ? `${row.userId.firstName} ${row.userId.lastName}` : '' },
      { key: 'email', label: 'Email', formatter: (_, row) => row.userId?.email || '' },
      { key: 'phone', label: 'Phone', formatter: (_, row) => row.userId?.phone || '' },
      { key: 'balance', label: 'Balance', formatter: (v, row) => formatCurrencyCSV(v, row.currency) },
      { key: 'currency', label: 'Currency' },
      { key: 'interestRate', label: 'Interest Rate (%)' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Opened', formatter: formatDateTimeCSV },
    ];

    const csv = generateCSV(accounts, columns);
    setCSVHeaders(res, `accounts-${Date.now()}.csv`);
    logAudit({ action: 'CSV_EXPORT', resource: 'accounts', userId: req.user._id, count: accounts.length });
    res.send(csv);
  } catch (error) {
    logger.error(`Export accounts error: ${error.message}`);
    next(error);
  }
};

export const exportLoans = async (req, res, next) => {
  try {
    const { status, loanType, minAmount, maxAmount, startDate, endDate } = req.query;
    const query = {};
    if (req.user.role === 'customer') query.userId = req.user._id;
    if (status) query.status = status;
    if (loanType) query.loanType = loanType;
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    applyDateFilter(query, startDate, endDate);

    const loans = await Loan.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort('-createdAt')
      .limit(100000)
      .lean();

    const columns = [
      { key: 'loanNumber', label: 'Loan Number' },
      { key: 'borrower', label: 'Borrower', formatter: (_, row) => row.userId ? `${row.userId.firstName} ${row.userId.lastName}` : '' },
      { key: 'loanType', label: 'Loan Type' },
      { key: 'amount', label: 'Amount', formatter: (v) => Number(v || 0).toFixed(2) },
      { key: 'interestRate', label: 'Interest Rate (%)' },
      { key: 'termMonths', label: 'Term (Months)' },
      { key: 'emiAmount', label: 'EMI', formatter: (v) => Number(v || 0).toFixed(2) },
      { key: 'status', label: 'Status' },
      { key: 'applicationDate', label: 'Applied On', formatter: formatDateCSV },
    ];

    const csv = generateCSV(loans, columns);
    setCSVHeaders(res, `loans-${Date.now()}.csv`);
    logAudit({ action: 'CSV_EXPORT', resource: 'loans', userId: req.user._id, count: loans.length });
    res.send(csv);
  } catch (error) {
    logger.error(`Export loans error: ${error.message}`);
    next(error);
  }
};

export const exportUsers = async (req, res, next) => {
  try {
    const { role, kycStatus, isActive } = req.query;
    const query = {};
    if (role) query.role = role;
    if (kycStatus) query.kycStatus = kycStatus;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('-password -twoFactorSecret -verificationToken -resetPasswordToken')
      .sort('-createdAt')
      .limit(100000)
      .lean();

    const columns = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Role' },
      { key: 'kycStatus', label: 'KYC Status' },
      { key: 'isVerified', label: 'Email Verified', formatter: (v) => (v ? 'Yes' : 'No') },
      { key: 'isActive', label: 'Active', formatter: (v) => (v ? 'Yes' : 'No') },
      { key: 'createdAt', label: 'Registered On', formatter: formatDateTimeCSV },
    ];

    const csv = generateCSV(users, columns);
    setCSVHeaders(res, `users-${Date.now()}.csv`);
    logAudit({ action: 'CSV_EXPORT', resource: 'users', userId: req.user._id, count: users.length });
    res.send(csv);
  } catch (error) {
    logger.error(`Export users error: ${error.message}`);
    next(error);
  }
};

export const exportFinancialSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateMatch = {};
    applyDateFilter(dateMatch, startDate, endDate);

    const [accountStats, transactionStats, loanStats] = await Promise.all([
      Account.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$accountType', count: { $sum: 1 }, totalBalance: { $sum: '$balance' }, avgBalance: { $avg: '$balance' } } }]),
      Transaction.aggregate([{ $match: { status: 'completed', ...dateMatch } }, { $group: { _id: '$type', count: { $sum: 1 }, totalAmount: { $sum: '$amount' }, totalFees: { $sum: '$fee' } } }]),
      Loan.aggregate([{ $match: dateMatch }, { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }]),
    ]);

    const rows = [
      ...accountStats.map((s) => ({ category: 'Accounts', metric: s._id, count: s.count, amount: s.totalBalance, avg: s.avgBalance })),
      ...transactionStats.map((s) => ({ category: 'Transactions', metric: s._id, count: s.count, amount: s.totalAmount, avg: s.count ? s.totalAmount / s.count : 0 })),
      ...loanStats.map((s) => ({ category: 'Loans', metric: s._id, count: s.count, amount: s.totalAmount, avg: s.count ? s.totalAmount / s.count : 0 })),
    ];

    const columns = [
      { key: 'category', label: 'Category' },
      { key: 'metric', label: 'Metric' },
      { key: 'count', label: 'Count' },
      { key: 'amount', label: 'Total Amount', formatter: (v) => Number(v || 0).toFixed(2) },
      { key: 'avg', label: 'Average', formatter: (v) => Number(v || 0).toFixed(2) },
    ];

    const csv = generateCSV(rows, columns);
    setCSVHeaders(res, `financial-summary-${Date.now()}.csv`);
    logAudit({ action: 'CSV_EXPORT', resource: 'financial_summary', userId: req.user._id });
    res.send(csv);
  } catch (error) {
    logger.error(`Export financial summary error: ${error.message}`);
    next(error);
  }
};