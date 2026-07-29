import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CART_SESSION_HEADER } from '../orders/orders.constants';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Inscription client' })
  register(
    @Body() dto: RegisterDto,
    @Headers(CART_SESSION_HEADER) sessionId?: string,
  ) {
    return this.authService.register(dto, sessionId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Connexion' })
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Headers(CART_SESSION_HEADER) sessionId?: string,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.authService.login(dto, ip, sessionId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchir le token d\'accès' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déconnexion' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Déconnexion réussie' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander une réinitialisation de mot de passe' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Confirmer l\'adresse email et activer le compte' })
  verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Headers(CART_SESSION_HEADER) sessionId?: string,
  ) {
    return this.authService.verifyEmail(dto.token, sessionId);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renvoyer l\'email de confirmation' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
    return {
      message:
        'Si un compte non activé existe avec cet email, un nouveau lien de confirmation a été envoyé.',
    };
  }
}
