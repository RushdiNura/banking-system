import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getUserNotifications,
  clearUserNotifications,
  getOnlineUsersCount,
} from "../config/socket.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get recent notifications
// @route   GET /api/v1/notifications
// @access  Private
router.get("/", async (req, res, next) => {
  try {
    const notifications = await getUserNotifications(req.user._id, 50);
    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Clear all notifications
// @route   DELETE /api/v1/notifications
// @access  Private
router.delete("/", async (req, res, next) => {
  try {
    await clearUserNotifications(req.user._id);
    res.status(200).json({
      success: true,
      message: "Notifications cleared",
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get online users count (admin only)
// @route   GET /api/v1/notifications/stats
// @access  Private (Admin)
router.get("/stats", async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    res.status(200).json({
      success: true,
      data: { onlineUsers: getOnlineUsersCount() },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
