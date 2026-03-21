import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthUser } from './common/types/auth-user.type';
import { UpdateProfileSettingsDto } from './auth/dto/update-profile-settings.dto';
import { ProfileSettingsService } from './profile-settings.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileSettingsController {
  constructor(private readonly profileSettingsService: ProfileSettingsService) {}

  @Get('settings')
  getSettings(@Req() request: { user: AuthUser }) {
    return this.profileSettingsService.getSettings(request.user.userId);
  }

  @Patch('settings')
  patchSettings(
    @Req() request: { user: AuthUser },
    @Body() dto: UpdateProfileSettingsDto,
  ) {
    return this.profileSettingsService.patchSettings(request.user.userId, dto);
  }
}

