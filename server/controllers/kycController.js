import { User } from "../models/User.js";
import { logger, logAudit } from "../utils/logger.js";
import { sendNotificationToUser } from "../config/socket.js";

// @desc    List all pending KYC submissions (employee/admin)
// @route   GET /api/v1/kyc/pending
// @access  Private (Employee/Admin)
export const listPendingKYC = async (req, res, next) => {
  try {
    const users = await User.find({ kycStatus: "pending" })
      .select(
        "firstName lastName email phone kycStatus documents createdAt updatedAt",
      )
      .sort("-updatedAt")
      .limit(100);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    logger.error(`List pending KYC error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single user's KYC details (employee/admin)
// @route   GET /api/v1/kyc/:userId
// @access  Private (Employee/Admin)
export const getKYCDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "firstName lastName email phone kycStatus documents createdAt",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Get KYC details error: ${error.message}`);
    next(error);
  }
};

// @desc    Approve or reject a user's KYC
// @route   PUT /api/v1/kyc/:userId/review
// @access  Private (Employee/Admin)
export const reviewKYC = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { decision, reason } = req.body; // 'approve' | 'reject'

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be "approve" or "reject"',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.kycStatus === "verified" && decision === "approve") {
      return res.status(400).json({
        success: false,
        message: "User is already verified",
      });
    }

    // Update KYC status
    user.kycStatus = decision === "approve" ? "verified" : "rejected";

    // Mark documents as verified (approve) or leave as-is (reject)
    if (decision === "approve" && user.documents?.length > 0) {
      user.documents = user.documents.map((doc) => ({
        ...doc.toObject(),
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user._id,
      }));
    }

    await user.save({ validateBeforeSave: false });

    // Notify the user in real-time
    try {
      await sendNotificationToUser(user._id.toString(), {
        type: "system",
        variant: decision === "approve" ? "success" : "error",
        title:
          decision === "approve"
            ? "KYC Approved! 🎉"
            : "KYC Verification Rejected",
        message:
          decision === "approve"
            ? "Your KYC has been verified. You can now open accounts and apply for loans."
            : `Your KYC was rejected. Reason: ${
                reason || "Please re-upload clear documents"
              }`,
        actionUrl: "/dashboard/profile",
      });
    } catch (err) {
      logger.warn(`Notification failed: ${err.message}`);
    }

    logAudit({
      action: "KYC_REVIEWED",
      targetUserId: user._id,
      email: user.email,
      decision,
      reason: reason || null,
      reviewedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: `KYC ${decision}d successfully`,
      data: {
        userId: user._id,
        kycStatus: user.kycStatus,
      },
    });
  } catch (error) {
    logger.error(`Review KYC error: ${error.message}`);
    next(error);
  }
};
