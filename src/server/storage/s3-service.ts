import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "../config/env";

/**
 * Enterprise S3-Compatible Object Storage Service.
 * Compatible with AWS S3, Cloudflare R2, MinIO (On-Premise Hospital), and Wasabi.
 *
 * Architecture Highlights:
 * - Direct Pre-signed Upload: Client streams audio directly to S3 without burdening web server.
 * - Secure Pre-signed Playback: Audio files remain private; only temporary signed URLs are issued.
 * - Auto-Purge Deletion: Secure deletion of patient voice recordings for privacy compliance (UU PDP).
 */
export const s3Client = new S3Client({
  endpoint: serverEnv.S3_ENDPOINT,
  region: serverEnv.S3_REGION,
  credentials: {
    accessKeyId: serverEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: serverEnv.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: serverEnv.S3_FORCE_PATH_STYLE,
});

export interface PresignedUploadResult {
  uploadUrl: string;
  s3Key: string;
  bucketName: string;
  expiresAt: string;
}

/**
 * Generates a pre-signed URL allowing the browser/client to upload
 * an audio recording directly to S3 without passing audio binary through the backend.
 */
export async function generatePresignedUploadUrl({
  consultationId,
  fileExtension = "webm",
  mimeType = "audio/webm",
  expiresInSeconds = serverEnv.PRESIGNED_URL_EXPIRES_SECONDS,
}: {
  consultationId: string;
  fileExtension?: string;
  mimeType?: string;
  expiresInSeconds?: number;
}): Promise<PresignedUploadResult> {
  const datePrefix = new Date().toISOString().slice(0, 10);
  const s3Key = `recordings/${datePrefix}/${consultationId}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: serverEnv.S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
    Metadata: {
      "consultation-id": consultationId,
      "uploaded-at": new Date().toISOString(),
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return {
    uploadUrl,
    s3Key,
    bucketName: serverEnv.S3_BUCKET_NAME,
    expiresAt,
  };
}

/**
 * Uploads an audio Buffer directly to S3 Object Storage.
 */
export async function uploadAudioBuffer({
  key,
  buffer,
  contentType = "audio/webm",
}: {
  key: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ s3Key: string; bucketName: string }> {
  const command = new PutObjectCommand({
    Bucket: serverEnv.S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return {
    s3Key: key,
    bucketName: serverEnv.S3_BUCKET_NAME,
  };
}


/**
 * Generates a temporary pre-signed URL to stream or listen to the audio recording.
 */
export async function generatePresignedPlaybackUrl(
  s3Key: string,
  expiresInSeconds = serverEnv.PRESIGNED_URL_EXPIRES_SECONDS,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: serverEnv.S3_BUCKET_NAME,
    Key: s3Key,
  });

  return await getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Permanently deletes an audio recording from Object Storage.
 * Essential for healthcare privacy compliance: voice recordings can be purged
 * once the doctor has reviewed and finalized the clinical SOAPI documentation.
 */
export async function deleteAudioFile(s3Key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: serverEnv.S3_BUCKET_NAME,
      Key: s3Key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete audio object [${s3Key}] from S3:`, error);
    return false;
  }
}

/**
 * Inspect object metadata (file size, contentType, ETag, lastModified).
 */
export async function getAudioMetadata(s3Key: string): Promise<{
  contentLength: number;
  contentType?: string;
  eTag?: string;
  lastModified?: Date;
} | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: serverEnv.S3_BUCKET_NAME,
      Key: s3Key,
    });
    const res = await s3Client.send(command);
    return {
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType,
      eTag: res.ETag,
      lastModified: res.LastModified,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Automatically creates the bucket if it does not exist yet.
 */
export async function ensureBucketExists(): Promise<boolean> {
  try {
    const headCommand = new HeadBucketCommand({
      Bucket: serverEnv.S3_BUCKET_NAME,
    });
    await s3Client.send(headCommand);
    return true;
  } catch {
    try {
      const createCommand = new CreateBucketCommand({
        Bucket: serverEnv.S3_BUCKET_NAME,
      });
      await s3Client.send(createCommand);
      console.log(`✅ S3 bucket '${serverEnv.S3_BUCKET_NAME}' created successfully.`);
      return true;
    } catch (err) {
      console.warn(`⚠️ Could not auto-create S3 bucket:`, err);
      return false;
    }
  }
}

/**
 * Checks connection and bucket availability in Object Storage.
 */
export async function checkStorageHealth(): Promise<{
  status: "healthy" | "unhealthy";
  bucket: string;
  endpoint: string;
  error?: string;
}> {
  try {
    await ensureBucketExists();
    return {
      status: "healthy",
      bucket: serverEnv.S3_BUCKET_NAME,
      endpoint: serverEnv.S3_ENDPOINT,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      bucket: serverEnv.S3_BUCKET_NAME,
      endpoint: serverEnv.S3_ENDPOINT,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
