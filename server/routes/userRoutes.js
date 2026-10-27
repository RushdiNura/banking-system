import express from "express";
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All user routes require authentication
router.use(protect);

// List users — employees and admins only
router.get("/", authorize("employee", "admin"), getUsers);

// Get single user — self or employee/admin
router.get("/:id", getUser);

// Update user — employee or admin (admins can change role)
router.put("/:id", authorize("employee", "admin"), updateUser);

// Delete user — admin only
router.delete("/:id", authorize("admin"), deleteUser);

export default router;
