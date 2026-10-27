import express from "express";
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  uploadKYC,
} from "../controllers/authController.js";
import { protect, authRateLimit } from "../middleware/auth.js";
import {
  uploadSingle,
  uploadMultiple,
  handleMulterError,
} from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);
router.post("/refresh-token", refreshToken);
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", authRateLimit, forgotPassword);
router.put("/reset-password/:token", resetPassword);

// Protected routes
router.use(protect); // All routes below require authentication

router.get("/me", getMe);
router.put("/profile", updateProfile);
router.post(
  "/profile-picture",
  uploadSingle("profilePicture"),
  handleMulterError,
  uploadProfilePicture,
);
router.put("/change-password", changePassword);
router.post(
  "/kyc",
  uploadMultiple("documents", 5),
  handleMulterError,
  uploadKYC,
);
router.post("/logout", logout);

export default router;
