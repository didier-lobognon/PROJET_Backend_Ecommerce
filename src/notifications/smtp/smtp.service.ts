import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { EmailTemplate } from '../notifications.constants';

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get('SMTP_HOST') &&
        this.config.get('SMTP_USER') &&
        this.config.get('SMTP_PASS'),
    );
  }

  /** Display name + address for nodemailer (e.g. "Kaniê" <user@gmail.com>). */
  private getFromAddress(): { name: string; address: string } {
    const name = this.config.get<string>('SMTP_FROM_NAME', 'Kaniê');
    const address =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER') ||
      'noreply@kanie.ci';
    return { name, address };
  }

  async send(
    to: string,
    subject: string,
    template: EmailTemplate,
    context: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('SMTP non configuré');
    }

    const html = this.renderTemplate(template, context);
    const from = this.getFromAddress();

    const transport = this.getTransporter();
    await transport.sendMail({ from, to, subject, html });
    this.logger.log(`Email sent: template=${template} to=${to}`);
  }

  async sendRaw(to: string, subject: string, htmlBody: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('SMTP non configuré');
    }

    const from = this.getFromAddress();
    const transport = this.getTransporter();
    await transport.sendMail({
      from,
      to,
      subject,
      html: htmlBody.replace(/\n/g, '<br>'),
    });
    this.logger.log(`Email sent (raw): subject=${subject} to=${to}`);
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  private resolveTemplatePath(template: EmailTemplate): string {
    const candidates = [
      path.join(__dirname, '..', 'templates', `${template}.hbs`),
      path.join(process.cwd(), 'src', 'notifications', 'templates', `${template}.hbs`),
    ];

    for (const templatePath of candidates) {
      if (fs.existsSync(templatePath)) {
        return templatePath;
      }
    }

    throw new Error(`Email template not found: ${template}`);
  }

  private renderTemplate(template: EmailTemplate, context: Record<string, unknown>): string {
    if (!this.templateCache.has(template)) {
      const templatePath = this.resolveTemplatePath(template);
      const source = fs.readFileSync(templatePath, 'utf8');
      this.templateCache.set(template, Handlebars.compile(source));
    }

    return this.templateCache.get(template)!(context);
  }
}
