import { User } from "../models/User.js";
import { Account } from "../models/Account.js";
import { logger, logAudit } from "../utils/logger.js";

// @desc    List users (admin/employee)
// @route   GET /api/v1/users
// @access  Private (Employee/Admin)
export const getUsers = async (req, res, next) => {
  try {
    const {
      role,
      kycStatus,
      isActive,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const query = {};

    if (role) query.role = role;
    if (kycStatus) query.kycStatus = kycStatus;
    if (isActive !== undefined) query.isActive = isActive === "true";

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select(
          "-password -twoFactorSecret -verificationToken -resetPasswordToken",
        )
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: users,
    });
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private (Employee/Admin, or self)
export const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Customers can only view themselves
    if (req.user.role === "customer" && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user",
      });
    }

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const accounts = await Account.find({
      userId: user._id,
      isDeleted: false,
    }).select("accountNumber accountType balance currency status");

    res.status(200).json({
      success: true,
      data: { ...user.toObject(), accounts },
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`);
    next(error);
  }
};

// @desc    Update user (admin/employee)
// @route   PUT /api/v1/users/:id
// @access  Private (Employee/Admin)
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Only admins can change roles
    if (updates.role && req.user.role !== "admin") {
      delete updates.role;
    }

    // Never allow password change through this endpoint
    delete updates.password;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    logAudit({
      action: "USER_UPDATED",
      targetUserId: id,
      performedBy: req.user._id,
      changes: Object.keys(updates),
    });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    next(error);
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/v1/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Soft delete
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save({ validateBeforeSave: false });

    logAudit({
      action: "USER_DEACTIVATED",
      targetUserId: id,
      performedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "User deactivated",
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`);
    next(error);
  }
};
