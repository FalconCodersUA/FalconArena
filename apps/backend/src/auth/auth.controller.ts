import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
  @Roles('ADMIN', 'ORGANIZER')
  @RateLimit({
    bucket: 'admin-create-user',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  createUserByAdmin(
    @Body() dto: CreateUserByAdminDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.authService.createUserByAdmin(dto, request.user);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'auth-login',
    limit: 5,
    windowSeconds: 60,
    keyStrategy: 'email',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google')
  startGoogleOAuth(@Res() response: { redirect: (url: string) => void }) {
    response.redirect(this.authService.getOAuthAuthorizationUrl(OAuthProvider.GOOGLE));
  }

  @Get('google/callback')
  async completeGoogleOAuth(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: { redirect: (url: string) => void },
  ) {
    await this.completeOAuthCallback(OAuthProvider.GOOGLE, code, error, response);
  }

  @Get('github')
  startGitHubOAuth(@Res() response: { redirect: (url: string) => void }) {
    response.redirect(this.authService.getOAuthAuthorizationUrl(OAuthProvider.GITHUB));
  }

  @Get('github/callback')
  async completeGitHubOAuth(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: { redirect: (url: string) => void },
  ) {
    await this.completeOAuthCallback(OAuthProvider.GITHUB, code, error, response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: { user: AuthUser }) {
    return this.authService.me(request.user.userId);
  }

  @Get('admin/ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  adminPing(@Req() request: { user: AuthUser }) {
    return {
      ok: true,
      role: request.user.role,
      userId: request.user.userId,
    };
  }

  private async completeOAuthCallback(
    provider: OAuthProvider,
    code: string | undefined,
    error: string | undefined,
    response: { redirect: (url: string) => void },
  ) {
    if (error) {
      response.redirect(this.authService.buildOAuthFailureRedirect(error));
      return;
    }

    if (!code) {
      response.redirect(this.authService.buildOAuthFailureRedirect('missing_code'));
      return;
    }

    try {
      const authResponse = await this.authService.completeOAuthLogin(provider, code);
      response.redirect(this.authService.buildOAuthSuccessRedirect(authResponse));
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'oauth_failed';
      response.redirect(this.authService.buildOAuthFailureRedirect(message));
    }
  }
}
