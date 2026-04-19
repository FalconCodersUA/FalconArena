import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { getStorageConfig } from './storage-config';

type StoreObjectInput = {
  directory: string;
  fileName: string;
  contentType: string;
  body: Buffer;
};

@Injectable()
export class StorageService {
  private readonly config = getStorageConfig();

  async storeAvatar(input: {
    userId: string;
    extension: string;
    mimeType: string;
    body: Buffer;
  }) {
    const fileName = `${input.userId}-${Date.now()}-${randomUUID()}.${input.extension}`;
    return this.storeObject({
      directory: 'avatars',
      fileName,
      contentType: input.mimeType,
      body: input.body,
    });
  }

  async storePlatformBanner(input: {
    extension: string;
    mimeType: string;
    body: Buffer;
  }) {
    const fileName = `about-${Date.now()}-${randomUUID()}.${input.extension}`;
    return this.storeObject({
      directory: 'about-banners',
      fileName,
      contentType: input.mimeType,
      body: input.body,
    });
  }

  async removeManagedObject(url: string | null | undefined) {
    if (!this.isManagedUrl(url)) {
      return;
    }

    if (this.config.provider === 'local') {
      await this.removeLocalObject(url as string);
      return;
    }

    await this.removeS3Object(url as string);
  }

  isManagedUrl(url: string | null | undefined) {
    if (typeof url !== 'string' || url.trim().length === 0) {
      return false;
    }

    const normalized = url.trim();
    if (this.config.provider === 'local') {
      return normalized.startsWith(`${this.config.local.publicPrefix}/`);
    }

    const publicBaseUrl = this.config.s3.publicBaseUrl;
    return publicBaseUrl.length > 0 && normalized.startsWith(`${publicBaseUrl}/`);
  }

  getLocalStaticRoot() {
    return this.config.local.rootDir;
  }

  private async storeObject(input: StoreObjectInput) {
    if (this.config.provider === 'local') {
      return this.storeLocalObject(input);
    }

    return this.storeS3Object(input);
  }

  private async storeLocalObject(input: StoreObjectInput) {
    const directoryPath = join(this.config.local.rootDir, input.directory);
    await mkdir(directoryPath, { recursive: true });
    const filePath = join(directoryPath, input.fileName);
    await writeFile(filePath, input.body);

    return {
      publicUrl: `${this.config.local.publicPrefix}/${input.directory}/${input.fileName}`,
      cleanupHandle: `${this.config.local.publicPrefix}/${input.directory}/${input.fileName}`,
    };
  }

  private async removeLocalObject(url: string) {
    const relativePath = url
      .slice(this.config.local.publicPrefix.length)
      .replace(/^\/+/, '');

    if (relativePath.includes('..') || relativePath.includes('\\')) {
      return;
    }

    const filePath = join(this.config.local.rootDir, relativePath);
    await rm(filePath, { force: true }).catch(() => undefined);
  }

  private async storeS3Object(input: StoreObjectInput) {
    this.assertS3Config();
    const key = this.buildS3ObjectKey(input.directory, input.fileName);
    const bodyHash = this.sha256Hex(input.body);
    const request = this.buildSignedS3Request({
      method: 'PUT',
      key,
      bodyHash,
    });

    const response = await fetch(request.url, {
      method: 'PUT',
      headers: {
        ...request.headers,
        'Content-Type': input.contentType,
      },
      body: new Uint8Array(input.body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `S3 upload failed with ${response.status}: ${errorBody}`,
      );
    }

    return {
      publicUrl: `${this.config.s3.publicBaseUrl}/${key}`,
      cleanupHandle: `${this.config.s3.publicBaseUrl}/${key}`,
    };
  }

  private async removeS3Object(url: string) {
    this.assertS3Config();
    const key = this.extractS3KeyFromUrl(url);
    if (!key) {
      return;
    }

    const bodyHash = this.sha256Hex('');
    const request = this.buildSignedS3Request({
      method: 'DELETE',
      key,
      bodyHash,
    });

    const response = await fetch(request.url, {
      method: 'DELETE',
      headers: request.headers,
    });

    if (!response.ok && response.status !== 404) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `S3 delete failed with ${response.status}: ${errorBody}`,
      );
    }
  }

  private assertS3Config() {
    const { endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl } = this.config.s3;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
      throw new InternalServerErrorException(
        'S3 storage is not fully configured. Check STORAGE_S3_* environment variables.',
      );
    }
  }

  private buildS3ObjectKey(directory: string, fileName: string) {
    const prefix = this.config.s3.keyPrefix.replace(/^\/+|\/+$/g, '');
    return [prefix, directory, fileName].filter(Boolean).join('/');
  }

  private extractS3KeyFromUrl(url: string) {
    const publicBaseUrl = `${this.config.s3.publicBaseUrl}/`;
    if (!url.startsWith(publicBaseUrl)) {
      return null;
    }

    return url.slice(publicBaseUrl.length);
  }

  private buildSignedS3Request(input: {
    method: 'PUT' | 'DELETE';
    key: string;
    bodyHash: string;
  }) {
    const endpointUrl = new URL(this.config.s3.endpoint);
    const basePath = endpointUrl.pathname.replace(/\/+$/, '');
    const encodedKey = input.key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');

    let host = endpointUrl.host;
    let canonicalUri = `${basePath}/${encodedKey}`.replace(/\/{2,}/g, '/');

    if (this.config.s3.forcePathStyle) {
      canonicalUri = `${basePath}/${this.config.s3.bucket}/${encodedKey}`.replace(
        /\/{2,}/g,
        '/',
      );
    } else {
      host = `${this.config.s3.bucket}.${endpointUrl.host}`;
    }

    const requestUrl = `${endpointUrl.protocol}//${host}${canonicalUri}`;
    const now = new Date();
    const amzDate = this.toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.config.s3.region}/s3/aws4_request`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${input.bodyHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      input.method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      input.bodyHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = this.signAwsV4(stringToSign, dateStamp);

    return {
      url: requestUrl,
      headers: {
        host,
        'x-amz-content-sha256': input.bodyHash,
        'x-amz-date': amzDate,
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${this.config.s3.accessKeyId}/${credentialScope}, ` +
          `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    };
  }

  private signAwsV4(stringToSign: string, dateStamp: string) {
    const kDate = this.hmac(`AWS4${this.config.s3.secretAccessKey}`, dateStamp);
    const kRegion = this.hmac(kDate, this.config.s3.region);
    const kService = this.hmac(kRegion, 's3');
    const kSigning = this.hmac(kService, 'aws4_request');
    return createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  }

  private hmac(key: string | Buffer, value: string) {
    return createHmac('sha256', key).update(value).digest();
  }

  private sha256Hex(value: string | Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }

  private toAmzDate(value: Date) {
    return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }
}
