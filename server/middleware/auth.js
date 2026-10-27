import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { redisClient } from "../server.js";
import { logger, logSecurityEvent } from "../utils/logger.js";

// Helper: is Redis ready?
const redisReady = () => redisClient.isOpen && redisClient.isReady;

// Protect routes - require authentication
export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "banking-system",
        audience: "banking-users",
      });

      // Optional blacklist check (skip if Redis unavailable)
      if (redisReady()) {
        try {
          const blacklisted = await redisClient.get(`blacklist:${token}`);
          if (blacklisted) {
            return res.status(401).json({
              success: false,
              message: "Token has been invalidated",
            });
          }
        } catch (err) {
          logger.warn(`Blacklist check skipped: ${err.message}`);
        }
      }

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account has been deactivated",
        });
      }

      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const remainingTime = Math.ceil(
          (user.lockedUntil - Date.now()) / 1000 / 60,
        );
        return res.status(423).json({
          success: false,
          message: `Account is locked. Try again in ${remainingTime} minutes`,
        });
      }

      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired",
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

// Authorize by role
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      logSecurityEvent({
        event: "unauthorized_access_attempt",
        userId: req.user._id,
        attemptedRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};

// Check if user is verified


// Check if KYC is verified
export const requireKYC = (req, res, next) => {
  if (req.user.kycStatus !== "verified") {
    return res.status(403).json({
      success: false,
      message: "KYC verification required for this operation",
    });
  }
  next();
};

// Rate limit specific to authentication
export const authRateLimit = async (req, res, next) => {
  if (!redisReady()) return next();

  try {
    const key = `auth_rate:${req.ip}`;
    const current = await redisClient.incr(key);

    if (current === 1) {
      await redisClient.expire(key, 900);
    }

    if (current > 50) {
      logSecurityEvent({
        event: "auth_rate_limit_exceeded",
        ip: req.ip,
        endpoint: req.originalUrl,
      });

      return res.status(429).json({
        success: false,
        message: "Too many authentication attempts. Please try again later.",
      });
    }

    next();
  } catch (error) {
    logger.warn(`Auth rate limit skipped: ${error.message}`);
    next();
  }
};

// Track last activity (for presence indicators)
export const trackActivity = async (req, res, next) => {
  if (!req.user || !redisReady()) return next();
  try {
    await redisClient.set(`activity:${req.user._id}`, Date.now(), { EX: 300 });
    next();
  } catch {
    next();
  }
};

// Verify refresh token
export const verifyRefreshToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: "banking-system",
    audience: "banking-users",
  });

  if (redisReady()) {
    try {
      const blacklisted = await redisClient.get(`refresh_blacklist:${token}`);
      if (blacklisted) {
        throw new Error("Refresh token has been invalidated");
      }
    } catch (err) {
      if (err.message.includes("invalidated")) throw err;
      // Otherwise ignore Redis failure
    }
  }

  return decoded;
};

// Check if user is online (for WebSocket / presence)
export const isUserOnline = async (userId) => {
  if (!redisReady()) return false;
  try {
    const lastActivity = await redisClient.get(`activity:${userId}`);
    return lastActivity ? Date.now() - parseInt(lastActivity) < 300000 : false;
  } catch {
    return false;
  }
};

export default {
  protect,
  authorize,
  requireKYC,
  authRateLimit,
  trackActivity,
  verifyRefreshToken,
  isUserOnline,
};
