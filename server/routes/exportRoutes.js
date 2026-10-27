import express from "express";
import {
  exportTransactions,
  exportAccounts,
  exportLoans,
  exportUsers,
  exportFinancialSummary,
} from "../controllers/exportController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All export routes require auth
router.use(protect);

// Customer-accessible exports (scoped to own data)
router.get("/transactions", exportTransactions);
router.get("/accounts", exportAccounts);
router.get("/loans", exportLoans);

// Admin/employee-only exports
router.get("/users", authorize("employee", "admin"), exportUsers);
router.get("/financial-summary", authorize("admin"), exportFinancialSummary);

export default router;
