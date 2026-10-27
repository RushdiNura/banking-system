import express from "express";
import {
  listPendingKYC,
  getKYCDetails,
  reviewKYC,
} from "../controllers/kycController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All KYC routes require authentication
router.use(protect);

// Employee/Admin endpoints only
router.use(authorize("employee", "admin"));

// List all pending submissions
router.get("/pending", listPendingKYC);

// Get single user's KYC details
router.get("/:userId", getKYCDetails);

// Approve or reject
router.put("/:userId/review", reviewKYC);

export default router;
