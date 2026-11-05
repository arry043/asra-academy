import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../lib/logger.js';

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // '%PDF-'

export interface StoredResumeMetadata {
  assetId: string;
  originalName: string;
  mimeType: 'application/pdf';
  fileSize: number;
  storageProvider: 'cloudinary' | 'local';
}

export interface UploadResumeResult extends StoredResumeMetadata {
  uploadToken: string;
}

class ResumeStorageService {
  private localUploadsDir: string;
  private inMemoryResumes: Map<string, { buffer: Buffer; metadata: StoredResumeMetadata }> =
    new Map();

  constructor() {
    this.localUploadsDir = path.resolve(process.cwd(), 'storage', 'resumes');
    // Ensure storage directory exists if using local storage
    try {
      if (!fs.existsSync(this.localUploadsDir)) {
        fs.mkdirSync(this.localUploadsDir, { recursive: true });
      }
    } catch (err) {
      logger.warn({ err }, 'Could not create local resume storage directory');
    }
  }

  public isCloudinaryConfigured(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    return Boolean(cloudName && apiKey && apiSecret);
  }

  /**
   * Validates a buffer is a genuine, well-formed PDF file within size constraints.
   */
  public validatePdfBuffer(buffer: Buffer, originalFilename: string): void {
    if (buffer.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Uploaded resume file is empty');
    }

    if (buffer.length > MAX_RESUME_SIZE_BYTES) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Resume file size exceeds the maximum limit of ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    const ext = path.extname(originalFilename).toLowerCase();
    if (ext !== '.pdf') {
      throw new AppError('VALIDATION_ERROR', 'Only PDF resume files (.pdf) are accepted');
    }

    // Verify magic header %PDF-
    if (buffer.length < 5 || !buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Invalid or corrupted PDF file. File header signature mismatch',
      );
    }
  }

  /**
   * Generates a tamper-proof upload token using HMAC.
   */
  public createUploadToken(assetId: string, fileSize: number): string {
    const secret = process.env.JWT_SECRET || 'recruitment-resume-upload-secret-32-chars';
    const payload = `${assetId}:${fileSize}`;
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}:${hmac}`;
  }

  /**
   * Verifies an upload token.
   */
  public verifyUploadToken(token: string, assetId: string, fileSize: number): boolean {
    const secret = process.env.JWT_SECRET || 'recruitment-resume-upload-secret-32-chars';
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const [tAssetId, tFileSize, hmac] = parts;
    if (!tAssetId || !tFileSize || !hmac) return false;
    if (tAssetId !== assetId || Number(tFileSize) !== fileSize) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${tAssetId}:${tFileSize}`)
      .digest('hex');
    if (hmac.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  }

  /**
   * Stores a PDF resume buffer.
   */
  public async storeResume(buffer: Buffer, originalFilename: string): Promise<UploadResumeResult> {
    this.validatePdfBuffer(buffer, originalFilename);

    const safeId = `resume_${crypto.randomUUID().replace(/-/g, '')}.pdf`;
    const safeOriginalName = path.basename(originalFilename).replace(/[^\w.-]/g, '_');
    const fileSize = buffer.length;

    // Cloudinary upload if configured
    if (this.isCloudinaryConfigured()) {
      try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
        const apiKey = process.env.CLOUDINARY_API_KEY!.trim();
        const apiSecret = process.env.CLOUDINARY_API_SECRET!.trim();
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = 'asra_recruitment_resumes';
        const publicId = safeId.replace(/\.pdf$/, '');

        // Generate SHA-1 signature for Cloudinary upload
        const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: 'application/pdf' }), safeOriginalName);
        formData.append('api_key', apiKey);
        formData.append('timestamp', String(timestamp));
        formData.append('folder', folder);
        formData.append('public_id', publicId);
        formData.append('signature', signature);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          logger.error({ status: response.status, errText }, 'Cloudinary upload failed');
          throw new AppError('INTERNAL_ERROR', 'Cloud resume upload failed');
        }

        const metadata: StoredResumeMetadata = {
          assetId: safeId,
          originalName: safeOriginalName,
          mimeType: 'application/pdf',
          fileSize,
          storageProvider: 'cloudinary',
        };

        const uploadToken = this.createUploadToken(safeId, fileSize);
        return { ...metadata, uploadToken };
      } catch (err) {
        logger.error({ err }, 'Error uploading to Cloudinary, falling back to local');
        if (err instanceof AppError) throw err;
      }
    }

    // Local / In-memory storage fallback
    if (process.env.NODE_ENV === 'test') {
      const metadata: StoredResumeMetadata = {
        assetId: safeId,
        originalName: safeOriginalName,
        mimeType: 'application/pdf',
        fileSize,
        storageProvider: 'local',
      };
      this.inMemoryResumes.set(safeId, { buffer, metadata });
      const uploadToken = this.createUploadToken(safeId, fileSize);
      return { ...metadata, uploadToken };
    }

    // Save to disk
    const targetPath = path.join(this.localUploadsDir, safeId);
    await fs.promises.writeFile(targetPath, buffer);

    const metadata: StoredResumeMetadata = {
      assetId: safeId,
      originalName: safeOriginalName,
      mimeType: 'application/pdf',
      fileSize,
      storageProvider: 'local',
    };

    const uploadToken = this.createUploadToken(safeId, fileSize);
    return { ...metadata, uploadToken };
  }

  /**
   * Retrieves a resume stream for authorized admin viewing / downloading.
   */
  public async getResumeStream(
    assetId: string,
  ): Promise<{ stream: Readable; fileSize: number; originalName: string }> {
    // Check in-memory first (tests)
    const inMem = this.inMemoryResumes.get(assetId);
    if (inMem) {
      return {
        stream: Readable.from(inMem.buffer),
        fileSize: inMem.metadata.fileSize,
        originalName: inMem.metadata.originalName,
      };
    }

    // Check Cloudinary if configured
    if (this.isCloudinaryConfigured()) {
      try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
        const publicId = `asra_recruitment_resumes/${assetId.replace(/\.pdf$/, '')}`;
        // Direct download URL for raw asset
        const url = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}.pdf`;
        const res = await fetch(url);
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const stream = new Readable({
            async read() {
              const { done, value } = await reader.read();
              if (done) {
                this.push(null);
              } else {
                this.push(Buffer.from(value));
              }
            },
          });
          const len = Number(res.headers.get('content-length')) || 0;
          return {
            stream,
            fileSize: len,
            originalName: assetId,
          };
        }
      } catch (err) {
        logger.error({ err, assetId }, 'Could not retrieve resume from Cloudinary');
      }
    }

    // Check local filesystem
    const filePath = path.join(this.localUploadsDir, assetId);
    if (fs.existsSync(filePath)) {
      const stat = await fs.promises.stat(filePath);
      const stream = fs.createReadStream(filePath);
      return {
        stream,
        fileSize: stat.size,
        originalName: assetId,
      };
    }

    throw new AppError('NOT_FOUND', 'Resume file not found');
  }
}

export const resumeStorageService = new ResumeStorageService();
