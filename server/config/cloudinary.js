import cloudinary from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary (env vars already loaded by --env-file=.env)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload presets
const uploadPresets = {
  profile: {
    folder: 'banking-system/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
  documents: {
    folder: 'banking-system/documents',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
  },
  kyc: {
    folder: 'banking-system/kyc',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  },
  loan_documents: {
    folder: 'banking-system/loan-documents',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
  },
};

/**
 * Upload a file to Cloudinary.
 * Handles: Buffer (memory storage), file.path (disk storage), or raw string path.
 */
export const uploadToCloudinary = async (file, preset = 'documents', options = {}) => {
  try {
    const presetConfig = uploadPresets[preset] || uploadPresets.documents;

    const uploadOptions = {
      folder: presetConfig.folder,
      allowed_formats: presetConfig.allowed_formats,
      transformation: presetConfig.transformation,
      resource_type: 'auto',
      ...options,
    };

    const isPdf =
      file?.mimetype === 'application/pdf' ||
      (typeof file?.originalname === 'string' &&
        file.originalname.toLowerCase().endsWith('.pdf'));

    if (isPdf) {
      uploadOptions.resource_type = 'raw';
    }

    // Case 1: disk path (string)
    if (typeof file === 'string') {
      const result = await cloudinary.v2.uploader.upload(file, uploadOptions);
      return mapResult(result);
    }

    if (file?.path && typeof file.path === 'string') {
      const result = await cloudinary.v2.uploader.upload(file.path, uploadOptions);
      return mapResult(result);
    }

    // Case 2: buffer (memory storage)
    const buffer =
      file?.buffer instanceof Buffer
        ? file.buffer
        : file instanceof Buffer
        ? file
        : null;

    if (!buffer) {
      throw new Error(
        'No valid file provided. Expected Buffer, path string, or object with .buffer or .path.'
      );
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        uploadOptions,
        (error, uploaded) => {
          if (error) return reject(error);
          resolve(uploaded);
        }
      );
      Readable.from(buffer).pipe(uploadStream);
    });

    return mapResult(result);
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

const mapResult = (result) => ({
  publicId: result.public_id,
  url: result.secure_url,
  format: result.format,
  resourceType: result.resource_type,
  size: result.bytes,
  width: result.width,
  height: result.height,
  createdAt: result.created_at,
});

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    return await cloudinary.v2.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const generateSignedUrl = (publicId, options = {}) => {
  try {
    return cloudinary.v2.url(publicId, {
      secure: true,
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      ...options,
    });
  } catch (error) {
    console.error('Cloudinary signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

export const generateTransformedUrl = (publicId, transformations = []) => {
  try {
    return cloudinary.v2.url(publicId, {
      secure: true,
      transformation: transformations,
    });
  } catch (error) {
    console.error('Cloudinary transformation error:', error);
    throw new Error(`Failed to generate transformed URL: ${error.message}`);
  }
};

export default cloudinary;