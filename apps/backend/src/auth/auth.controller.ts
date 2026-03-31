import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
}
