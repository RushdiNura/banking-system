import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import mongoSanitize from "@exortek/express-mongo-sanitize";
import xssSanitizerPkg from "express-xss-sanitizer";
import hpp from "hpp";
import { createServer } from "http";
import { createClient } from "redis";

import { logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { initializeSocket } from "./config/socket.js";
import routes from "./routes/index.js";

const { xss: xssSanitizer } = xssSanitizerPkg;

// ---- Startup env sanity check ----
console.log("[BOOT] Env loaded:", {
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI ? "SET" : "MISSING",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "MISSING",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? "SET" : "MISSING",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "SET" : "MISSING",
});

export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.error(
          "[REDIS] failed after 5 retries — continuing without cache",
        );
        return new Error("Redis connection failed");
      }
      return Math.min(retries * 200, 2000);
    },
  },
});

let redisConnectedOnce = false;
redisClient.on("error", (err) => {
  if (!redisConnectedOnce) console.warn(`[REDIS] ${err.message}`);
});
redisClient.on("connect", () => {
  if (!redisConnectedOnce) {
    logger.info("Redis connected successfully");
    redisConnectedOnce = true;
  }
});

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
  }),
);

const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [process.env.CORS_ORIGIN || "https://your-production-domain.com"]
      : [
          process.env.CORS_ORIGIN || "http://localhost:5173",
          "http://localhost:5174",
          "http://127.0.0.1:5173",
        ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Idempotency-Key",
  ],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400,
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});
app.use("/api", limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use(mongoSanitize());
app.use(xssSanitizer({ allowedKeys: [] }));
app.use(hpp({ whitelist: ["sort", "page", "limit", "fields"] }));

app.use(compression());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );
}

app.use(
  "/uploads",
  express.static("uploads", { maxAge: "1d", etag: true, lastModified: true }),
);

app.get("/health", (req, res) => {
  res.status(200).json({
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    redis: redisClient.isReady ? "connected" : "disconnected",
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
  });
});

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: process.env.NODE_ENV !== "production",
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    // if (process.env.NODE_ENV === "production") {
    //   await conn.syncIndexes();
    // }
  } catch (error) {
    console.error("[MONGO] Connection failed:", error.message);
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.warn(
      `[REDIS] unavailable — continuing without cache: ${error.message}`,
    );
    logger.warn(
      `Redis unavailable — continuing without cache: ${error.message}`,
    );
  }
};

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("[BOOT] Starting banking server...");
  try {
    console.log("[BOOT] Connecting to MongoDB...");
    await connectDB();
    console.log("[BOOT] MongoDB connected ✓");

    console.log("[BOOT] Connecting to Redis...");
    await connectRedis();
    console.log("[BOOT] Redis ready (or skipped) ✓");

    const httpServer = createServer(app);
    console.log("[BOOT] Initializing Socket.IO...");
    initializeSocket(httpServer);
    console.log("[BOOT] Socket.IO initialized ✓");

    httpServer.listen(PORT, () => {
      logger.info(
        `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
      logger.info("Socket.IO ready for connections");
      console.log(`\n✅ Server listening on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);
    });

    httpServer.on("error", (err) => {
      console.error("[BOOT] HTTP server error:", err.message);
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
      }
      process.exit(1);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      httpServer.close(() => {
        mongoose.connection
          .close(false)
          .then(() => {
            if (redisClient.isOpen) redisClient.quit().catch(() => {});
            logger.info("Process terminated");
            process.exit(0);
          })
          .catch(() => process.exit(0));
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("[BOOT] Failed to start server:", error.message);
    console.error(error.stack);
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT]", err.message);
  console.error(err.stack);
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("[UNHANDLED REJECTION]", err?.message || err);
  console.error(err?.stack || "");
  logger.error(`Unhandled Rejection: ${err?.message || err}`);
});

startServer();

export default app;
