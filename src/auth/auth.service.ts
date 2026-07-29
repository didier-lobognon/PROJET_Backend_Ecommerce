import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtPayload as TokenPayload } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CartService } from '../orders/cart.service';
import {
  BCRYPT_SALT_ROUNDS,
  LOGIN_LOCK_TTL_SECONDS,
  LOGIN_MAX_ATTEMPTS,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  role: UserRole;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export interface RegisterPendingResponse {
  message: string;
  email: string;
}

@Injectable()
export class AuthService {
  private static readonly RESET_TOKEN_TTL = 3600; // 1 hour
  private static readonly VERIFY_TOKEN_TTL = 86400; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly cartService: CartService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(
    dto: RegisterDto,
    sessionId?: string,
  ): Promise<RegisterPendingResponse | { user: AuthUserResponse; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.CLIENT,
        emailVerifiedAt: this.isSmtpConfigured() ? null : new Date(),
        emailMarketingConsent: true,
        whatsappMarketingConsent: true,
        marketingConsentAt: new Date(),
        marketingConsentSource: 'registration',
      },
    });

    const fullName = [dto.firstName, dto.lastName].filter(Boolean).join(' ') || dto.email;
    await this.prisma.userAddress.create({
      data: {
        userId: user.id,
        fullName,
        phone: dto.phone,
        address: [dto.commune, dto.city].filter(Boolean).join(', '),
        city: dto.city,
        commune: dto.commune,
        isDefault: true,
      },
    });

    if (!this.isSmtpConfigured()) {
      const tokens = await this.generateTokens(user);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      if (sessionId) {
        await this.cartService.mergeGuestCart(sessionId, user.id);
      }

      return { user: this.toAuthUser(user), tokens };
    }

    await this.sendVerificationEmail(user);

    return {
      message:
        'Inscription réussie. Consultez votre boîte mail (y compris les spams) pour activer votre compte.',
      email: user.email,
    };
  }

  async login(dto: LoginDto, ip: string, sessionId?: string): Promise<{ user: AuthUserResponse; tokens: AuthTokens }> {
    await this.checkLoginRateLimit(ip);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await this.recordFailedLogin(ip);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.recordFailedLogin(ip);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Veuillez confirmer votre adresse email avant de vous connecter. Consultez votre boîte mail (y compris les spams) ou demandez un nouveau lien de confirmation.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Votre compte a été suspendu. Contactez le support Kaniê pour plus d\'informations.',
      );
    }

    await this.clearLoginAttempts(ip);

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    if (sessionId) {
      await this.cartService.mergeGuestCart(sessionId, user.id);
    }

    return { user: this.toAuthUser(user), tokens };
  }

  async verifyEmail(
    token: string,
    sessionId?: string,
  ): Promise<{ user: AuthUserResponse; tokens: AuthTokens; message: string }> {
    const key = `verify:${this.hashToken(token)}`;
    const userId = await this.redisService.get(key);

    if (!userId) {
      throw new BadRequestException('Lien de confirmation invalide ou expiré');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    await this.redisService.del(key);

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    if (sessionId) {
      await this.cartService.mergeGuestCart(sessionId, user.id);
    }

    return {
      user: this.toAuthUser(user),
      tokens,
      message: 'Votre compte a été activé avec succès.',
    };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) return;

    await this.sendVerificationEmail(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    if (!stored.user.emailVerifiedAt) {
      throw new ForbiddenException('Compte non activé');
    }

    if (!stored.user.isActive) {
      throw new ForbiddenException('Compte suspendu');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(stored.user);
    await this.storeRefreshToken(stored.user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const key = `reset:${this.hashToken(token)}`;
    await this.redisService.set(key, user.id);
    await this.redisService.expire(key, AuthService.RESET_TOKEN_TTL);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reinitialiser-mot-de-passe?token=${token}`;

    await this.notificationsService.notifyPasswordReset(user.id, user.email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const key = `reset:${this.hashToken(token)}`;
    const userId = await this.redisService.get(key);

    if (!userId) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redisService.del(key);
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const key = `verify:${this.hashToken(token)}`;
    await this.redisService.set(key, user.id);
    await this.redisService.expire(key, AuthService.VERIFY_TOKEN_TTL);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const verifyUrl = `${frontendUrl}/verifier-email?token=${token}`;
    const firstName = user.firstName ?? 'Client';

    await this.notificationsService.notifyEmailVerification(
      user.id,
      user.email,
      verifyUrl,
      firstName,
    );
  }

  private isSmtpConfigured(): boolean {
    return Boolean(
      this.configService.get('SMTP_HOST') &&
        this.configService.get('SMTP_USER') &&
        this.configService.get('SMTP_PASS'),
    );
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const expiresIn = (this.configService.get<string>('JWT_EXPIRES_IN') ??
      '15m') as JwtSignOptions['expiresIn'];

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn,
    });

    const refreshToken = randomBytes(64).toString('hex');

    return { accessToken, refreshToken, expiresIn: String(expiresIn) };
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = this.parseDuration(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: this.hashToken(refreshToken),
        expiresAt,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(duration: string): Date {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  private async checkLoginRateLimit(ip: string): Promise<void> {
    const key = `login:attempts:${ip}`;
    const attempts = await this.redisService.get(key);

    if (attempts && parseInt(attempts, 10) >= LOGIN_MAX_ATTEMPTS) {
      throw new ForbiddenException(
        'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      );
    }
  }

  private async recordFailedLogin(ip: string): Promise<void> {
    const key = `login:attempts:${ip}`;
    const attempts = await this.redisService.incr(key);

    if (attempts === 1) {
      await this.redisService.expire(key, LOGIN_LOCK_TTL_SECONDS);
    }
  }

  private async clearLoginAttempts(ip: string): Promise<void> {
    await this.redisService.del(`login:attempts:${ip}`);
  }

  private toAuthUser(user: User): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };
  }
}
