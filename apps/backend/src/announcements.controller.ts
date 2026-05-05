import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthUser } from './common/types/auth-user.type';
import {
  CreateAnnouncementDto,
  ListAnnouncementsDto,
  MarkAnnouncementsReadDto,
  UpdateAnnouncementDto,
} from './announcements.dto';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list(
    @Req() request: { user: AuthUser },
    @Query() query: ListAnnouncementsDto,
  ) {
    return this.announcementsService.listForRole(
      request.user.role,
      request.user.userId,
      query.includeInactive ?? false,
      query.tournamentId,
    );
  }

  @Patch('read-state')
  markRead(
    @Req() request: { user: AuthUser },
    @Body() dto: MarkAnnouncementsReadDto,
  ) {
    return this.announcementsService.markRead(
      request.user.userId,
      dto.publishedAt,
    );
  }

  @Post()
  @Roles('ADMIN', 'ORGANIZER')
  create(
    @Req() request: { user: AuthUser },
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(dto, request.user.userId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ORGANIZER')
  update(
    @Param('id') id: string,
    @Req() request: { user: AuthUser },
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, dto, request.user.userId);
  }
}
