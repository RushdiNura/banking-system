import multer from "multer";
import sharp from "sharp";
import path from "path";
import crypto from "crypto";
import { logger } from "../utils/logger.js";

// Memory storage for processing before upload
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    "image/jpeg": true,
    "image/png": true,
    "image/webp": true,
    "image/gif": true,
    "application/pdf": true,
    "application/msword": true,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 5, // Max 5 files per request
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits,
});

// Process image with Sharp before upload
export const processImage = async (buffer, options = {}) => {
  try {
    let processedImage = sharp(buffer);

    // Resize if width/height provided
    if (options.width || options.height) {
      processedImage = processedImage.resize(
        options.width || null,
        options.height || null,
        {
          fit: options.fit || "inside",
          withoutEnlargement: true,
        },
      );
    }

    // Compress and convert
    if (options.format === "webp") {
      processedImage = processedImage.webp({ quality: options.quality || 80 });
    } else if (options.format === "jpeg" || options.format === "jpg") {
      processedImage = processedImage.jpeg({ quality: options.quality || 80 });
    } else if (options.format === "png") {
      processedImage = processedImage.png({ quality: options.quality || 80 });
    }

    // Rotate based on EXIF data
    processedImage = processedImage.rotate();

    const processedBuffer = await processedImage.toBuffer();

    return {
      buffer: processedBuffer,
      mimetype: `image/${options.format || "jpeg"}`,
      originalname: `processed-${Date.now()}.${options.format || "jpg"}`,
      size: processedBuffer.length,
    };
  } catch (error) {
    logger.error(`Image processing error: ${error.message}`);
    throw new Error("Failed to process image");
  }
};

// Middleware for single file upload
export const uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

// Middleware for multiple files
export const uploadMultiple = (fieldName, maxCount = 5) => {
  return upload.array(fieldName, maxCount);
};

// Middleware for mixed fields
export const uploadFields = (fields) => {
  return upload.fields(fields);
};

// Error handler for multer
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds the limit (10MB)",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field name for file upload",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next();
};

// Validate file type
export const validateFileType = (file, allowedTypes) => {
  if (!file) return false;
  return allowedTypes.includes(file.mimetype);
};

// Generate unique filename
export const generateUniqueFilename = (originalname) => {
  const ext = path.extname(originalname);
  const randomString = crypto.randomBytes(16).toString("hex");
  return `${Date.now()}-${randomString}${ext}`;
};

export default upload;
