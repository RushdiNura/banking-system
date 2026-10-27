import express from "express";
import {
  applyForLoan,
  getLoans,
  getLoan,
  approveLoan,
  rejectLoan,
  disburseLoan,
  makeLoanPayment,
  getEMISchedule,
  getAllLoans,
  getLoanStats,
} from "../controllers/loanController.js";
import {
  protect,
  authorize,
 
  requireKYC,
} from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);


// Customer routes
router.post("/apply", requireKYC, applyForLoan);
router.get("/", getLoans);
router.get("/stats", getLoanStats);
router.get("/:id", getLoan);
router.get("/:id/emi-schedule", getEMISchedule);
router.post("/:id/pay", makeLoanPayment);

// Employee/Admin routes
router.get("/admin/all", authorize("employee", "admin"), getAllLoans);
router.put("/:id/approve", authorize("employee", "admin"), approveLoan);
router.put("/:id/reject", authorize("employee", "admin"), rejectLoan);
router.post("/:id/disburse", authorize("employee", "admin"), disburseLoan);

export default router;
