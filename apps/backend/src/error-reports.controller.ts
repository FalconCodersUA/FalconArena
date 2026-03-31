import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ErrorReportsService } from './error-reports.service';

@Controller('admin/error-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ErrorReportsController {
  constructor(private readonly errorReportsService: ErrorReportsService) {}

  @Get()
  listRecent(@Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '50', 10);
    return this.errorReportsService.getRecent(Number.isNaN(parsed) ? 50 : parsed);
  }
}
