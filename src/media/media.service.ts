import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as http from 'http';
import * as path from 'path';

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly endpoint: string;
  private readonly port: number;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private readonly useSSL: boolean;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT', '');
    this.port = this.config.get<number>('MINIO_PORT', 9000);
    this.accessKey = this.config.get<string>('MINIO_ACCESS_KEY', '');
    this.secretKey = this.config.get<string>('MINIO_SECRET_KEY', '');
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'kanie-media');
    this.useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
  }

  get isConfigured(): boolean {
    return Boolean(this.endpoint && this.accessKey && this.secretKey);
  }

  async onModuleInit() {
    if (!this.isConfigured) {
      this.logger.warn('MinIO not configured — using placeholder URLs');
      return;
    }

    try {
      const exists = await this.bucketExists();
      if (!exists) {
        await this.createBucket();
        this.logger.log(`Bucket "${this.bucket}" created`);
      } else {
        this.logger.log(`MinIO ready — bucket "${this.bucket}" exists`);
      }
    } catch (error) {
      this.logger.error(`MinIO init failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async upload(
    file: Buffer,
    originalName: string,
    mimetype: string,
    folder = 'uploads',
  ): Promise<string> {
    if (!this.isConfigured) {
      return this.getPlaceholderUrl(originalName);
    }

    const ext = path.extname(originalName) || '.jpg';
    const objectName = `${folder}/${randomUUID()}${ext}`;

    await this.putObject(objectName, file, mimetype);
    return this.buildPublicUrl(objectName);
  }

  async delete(url: string): Promise<void> {
    if (!this.isConfigured) return;
    const objectName = this.extractObjectName(url);
    if (objectName) {
      await this.deleteObject(objectName);
    }
  }

  resolveUrl(url: string): string {
    if (!url) return this.getPlaceholderUrl('image');
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return url;
    if (this.isConfigured) return this.buildPublicUrl(url);
    return this.getPlaceholderUrl(url);
  }

  getPlaceholderUrl(name: string): string {
    const encoded = encodeURIComponent(name.slice(0, 40));
    return `https://placehold.co/600x400/1a56db/ffffff?text=${encoded}`;
  }

  private buildPublicUrl(objectName: string): string {
    const protocol = this.useSSL ? 'https' : 'http';
    return `${protocol}://${this.endpoint}:${this.port}/${this.bucket}/${objectName}`;
  }

  private extractObjectName(url: string): string | null {
    const prefix = `/${this.bucket}/`;
    const idx = url.indexOf(prefix);
    if (idx === -1) return null;
    return url.slice(idx + prefix.length);
  }

  private makeAuthHeader(method: string, objectPath: string, date: string, contentType?: string): string {
    const { createHmac } = require('crypto');
    const stringToSign = `${method}\n\n${contentType || ''}\n${date}\n/${this.bucket}${objectPath}`;
    const signature = createHmac('sha1', this.secretKey).update(stringToSign).digest('base64');
    return `AWS ${this.accessKey}:${signature}`;
  }

  private request(
    method: string,
    objectPath: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const date = new Date().toUTCString();
      const auth = this.makeAuthHeader(method, objectPath, date, contentType);

      const options: http.RequestOptions = {
        hostname: this.endpoint,
        port: this.port,
        path: `/${this.bucket}${objectPath}`,
        method,
        headers: {
          Date: date,
          Authorization: auth,
          ...(contentType ? { 'Content-Type': contentType } : {}),
          ...(body ? { 'Content-Length': body.length } : {}),
        },
      };

      const req = http.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
          });
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  private async bucketExists(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const date = new Date().toUTCString();
      const { createHmac } = require('crypto');
      const stringToSign = `HEAD\n\n\n${date}\n/${this.bucket}/`;
      const signature = createHmac('sha1', this.secretKey).update(stringToSign).digest('base64');

      const options: http.RequestOptions = {
        hostname: this.endpoint,
        port: this.port,
        path: `/${this.bucket}/`,
        method: 'HEAD',
        headers: { Date: date, Authorization: `AWS ${this.accessKey}:${signature}` },
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async createBucket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const date = new Date().toUTCString();
      const { createHmac } = require('crypto');
      const stringToSign = `PUT\n\n\n${date}\n/${this.bucket}/`;
      const signature = createHmac('sha1', this.secretKey).update(stringToSign).digest('base64');

      const options: http.RequestOptions = {
        hostname: this.endpoint,
        port: this.port,
        path: `/${this.bucket}/`,
        method: 'PUT',
        headers: { Date: date, Authorization: `AWS ${this.accessKey}:${signature}` },
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`Create bucket failed: ${res.statusCode}`));
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async putObject(objectName: string, data: Buffer, contentType: string): Promise<void> {
    const result = await this.request('PUT', `/${objectName}`, data, contentType);
    if (result.statusCode !== 200) {
      throw new Error(`MinIO PUT failed: ${result.statusCode} ${result.body.slice(0, 200)}`);
    }
  }

  private async deleteObject(objectName: string): Promise<void> {
    await this.request('DELETE', `/${objectName}`);
  }
}
