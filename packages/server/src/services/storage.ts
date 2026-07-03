// ============================================
// S3-Compatible Object Storage Service
// ============================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/index.js';

const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true, // Required for MinIO
});

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  }));

  const stream = response.Body;
  if (!stream) throw new Error('Empty response body from S3');

  // Collect stream into buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  }));
}
