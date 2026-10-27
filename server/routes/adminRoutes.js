import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { getOnlineUsersCount } from "../config/socket.js";

const router = express.Router();

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize("admin"));

// @desc    Admin dashboard stats
// @route   GET /api/v1/admin/stats
router.get("/stats", async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      onlineUsers: getOnlineUsersCount(),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
