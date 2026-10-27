import express from "express";
import {
  transferFunds,
  depositFunds,
  withdrawFunds,
  getTransactions,
  getTransaction,
  reverseTransaction,
  getTransactionStats,
} from "../controllers/transactionController.js";
import {
  protect,
  authorize,

  requireKYC,
} from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);


// Transaction routes
router.get("/", getTransactions);
router.get("/stats", getTransactionStats);
router.get("/:id", getTransaction);

// Transfer (requires KYC)
router.post("/transfer", requireKYC, transferFunds);

// Deposit/Withdraw
router.post("/deposit", authorize("employee", "admin"), depositFunds);
router.post("/withdraw", requireKYC, withdrawFunds);

// Reverse (employee/admin only)
router.post("/:id/reverse", authorize("employee", "admin"), reverseTransaction);

export default router;
