import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildSessionAudioPrefix } from "@/lib/uploaded-audio";

export class S3AudioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "S3AudioConfigError";
  }
}

function requireS3Config() {
  const bucket = process.env.S3_AUDIO_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new S3AudioConfigError(
      "S3 audio storage is not configured. Set S3_AUDIO_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
    );
  }

  return { bucket, region, accessKeyId, secretAccessKey };
}

let s3Client: S3Client | null = null;

function getS3Client() {
  if (s3Client) return s3Client;
  const { region, accessKeyId, secretAccessKey } = requireS3Config();
  s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    // Browser PUT uploads cannot send SDK checksum headers from presigned URLs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3Client;
}

function getBucketName() {
  return requireS3Config().bucket;
}

export async function createUploadPresignedUrl(
  key: string,
  contentType: string,
  sizeBytes: number,
) {
  const client = getS3Client();
  const bucket = getBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: 900,
    unhoistableHeaders: new Set(["content-type"]),
  });
  return { uploadUrl, key, bucket };
}

export async function headAudioObject(key: string) {
  const client = getS3Client();
  const bucket = getBucketName();
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return {
    contentLength: response.ContentLength ?? 0,
    contentType: response.ContentType ?? "application/octet-stream",
  };
}

export async function getAudioObjectBuffer(key: string): Promise<Buffer> {
  const stream = await getAudioStream(key);
  const bytes = await stream.body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function getAudioStream(key: string, rangeHeader?: string | null) {
  const client = getS3Client();
  const bucket = getBucketName();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: rangeHeader ?? undefined,
    }),
  );

  if (!response.Body) {
    throw new Error("Audio object has no body");
  }

  return {
    body: response.Body,
    contentType: response.ContentType ?? "application/octet-stream",
    contentLength: response.ContentLength,
    contentRange: response.ContentRange,
    acceptRanges: response.AcceptRanges ?? "bytes",
    statusCode: rangeHeader ? 206 : 200,
  };
}

export async function deleteAudioObject(key: string) {
  const client = getS3Client();
  const bucket = getBucketName();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function deleteSessionAudioFolder(sessionId: string) {
  const client = getS3Client();
  const bucket = getBucketName();
  const prefix = buildSessionAudioPrefix(sessionId);

  let continuationToken: string | undefined;
  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects =
      list.Contents?.flatMap((item) => (item.Key ? [{ Key: item.Key }] : [])) ?? [];
    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects },
        }),
      );
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}

export function isS3AudioConfigError(err: unknown): err is S3AudioConfigError {
  return err instanceof S3AudioConfigError;
}
