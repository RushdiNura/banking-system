import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { redisClient } from "../server.js";
import { logger } from "../utils/logger.js";

let io = null;

// Track connected users: Map<userId, Set<socketId>>
const connectedUsers = new Map();

/**
 * Initialize Socket.IO server
 * @param {http.Server} httpServer - Node HTTP server instance
 * @returns {Server} io - Socket.IO server instance
 */
export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? [process.env.CORS_ORIGIN || "https://your-production-domain.com"]
          : [
              "http://localhost:5173",
              "http://localhost:5174",
              "http://127.0.0.1:5173",
            ],
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 1e6,
  });

  // -------- Auth middleware --------
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "banking-system",
        audience: "banking-users",
      });

      // Optional blacklist check
      try {
        const blacklisted = await redisClient.get(`blacklist:${token}`);
        if (blacklisted) {
          return next(new Error("Token has been invalidated"));
        }
      } catch {
        // Redis unavailable — non-fatal
      }

      const user = await User.findById(decoded.id).select(
        "firstName lastName email role isActive",
      );

      if (!user || !user.isActive) {
        return next(new Error("User not found or inactive"));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.user = {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      logger.error(`Socket auth error: ${error.message}`);
      next(new Error("Authentication failed"));
    }
  });

  // -------- Connection handler --------
  io.on("connection", async (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

    if (!connectedUsers.has(socket.userId)) {
      connectedUsers.set(socket.userId, new Set());
    }
    connectedUsers.get(socket.userId).add(socket.id);

    try {
      await redisClient.set(`online:${socket.userId}`, "1", "EX", 300);
    } catch {
      // ignore Redis failure
    }

    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);

    socket.emit("connected", {
      message: "Connected to notification service",
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });

    socket.on("mark-read", async (notificationId) => {
      try {
        await redisClient.hDel(
          `notifications:${socket.userId}`,
          notificationId,
        );
        socket.emit("notification-read", { id: notificationId });
      } catch (error) {
        logger.error(`Mark read error: ${error.message}`);
      }
    });

    socket.on("typing", (data) => {
      socket.to(`user:${data.recipientId}`).emit("user-typing", {
        from: socket.userId,
        ...data,
      });
    });

    socket.on("disconnect", async () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);

      const userSockets = connectedUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(socket.userId);
          setTimeout(async () => {
            if (!connectedUsers.has(socket.userId)) {
              try {
                await redisClient.del(`online:${socket.userId}`);
              } catch {
                // ignore
              }
            }
          }, 30000);
        }
      }
    });

    socket.on("error", (error) => {
      logger.error(`Socket error (${socket.id}): ${error.message}`);
    });
  });

  logger.info("Socket.IO initialized");
  return io;
};

/**
 * Get the Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

/**
 * Check if a user is online
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId?.toString());
};

/**
 * Get count of connected users
 */
export const getOnlineUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Send a real-time notification to a specific user
 */
export const sendNotificationToUser = async (userId, notification) => {
  try {
    if (!io) return null;

    const enrichedNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };

    try {
      await redisClient.lPush(
        `notifications:${userId}`,
        JSON.stringify(enrichedNotification),
      );
      await redisClient.lTrim(`notifications:${userId}`, 0, 49);
    } catch {
      // ignore Redis failure
    }

    io.to(`user:${userId}`).emit("notification", enrichedNotification);
    logger.info(`Notification sent to user ${userId}: ${notification.title}`);
    return enrichedNotification;
  } catch (error) {
    logger.error(`Send notification error: ${error.message}`);
    return null;
  }
};

/**
 * Send a notification to all users with a specific role
 */
export const sendNotificationToRole = (role, notification) => {
  if (!io) return;

  const enrichedNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
    ...notification,
  };

  io.to(`role:${role}`).emit("notification", enrichedNotification);
  logger.info(`Notification sent to role ${role}: ${notification.title}`);
};

/**
 * Broadcast a notification to all connected users
 */
export const broadcastNotification = (notification) => {
  if (!io) return;

  const enrichedNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
    ...notification,
  };

  io.emit("notification", enrichedNotification);
  logger.info(`Broadcast notification: ${notification.title}`);
};

/**
 * Get recent notifications for a user from Redis
 */
export const getUserNotifications = async (userId, limit = 20) => {
  // Skip gracefully if Redis is offline
  if (!redisClient.isOpen || !redisClient.isReady) {
    return [];
  }

  try {
    const raw = await redisClient.lRange(
      `notifications:${userId}`,
      0,
      limit - 1,
    );
    return raw
      .map((n) => {
        try {
          return JSON.parse(n);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    logger.warn(`Get notifications skipped: ${error.message}`);
    return [];
  }
};
/**
 * Clear all notifications for a user
 */
export const clearUserNotifications = async (userId) => {
  if (!redisClient.isOpen || !redisClient.isReady) return;

  try {
    await redisClient.del(`notifications:${userId}`);
  } catch (error) {
    logger.warn(`Clear notifications skipped: ${error.message}`);
  }
};

export default {
  initializeSocket,
  getIO,
  isUserOnline,
  getOnlineUsersCount,
  sendNotificationToUser,
  sendNotificationToRole,
  broadcastNotification,
  getUserNotifications,
  clearUserNotifications,
};
