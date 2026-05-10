import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ListManagedUsersDto } from './dto/list-managed-users.dto';
import { ResetManagedUserPasswordDto } from './dto/reset-managed-user-password.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('export.csv')
  async exportManagedUsersCsv(
    @Query() query: ListManagedUsersDto,
    @Res({ passthrough: true })
    response: {
      setHeader(name: string, value: string): void;
    },
  ) {
    const csv = await this.usersService.exportManagedUsersCsv(query);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="users-export.csv"',
    );

    return csv;
  }

  @Get()
  listManagedUsers(@Query() query: ListManagedUsersDto) {
    return this.usersService.listManagedUsers(query);
  }

  @Patch(':userId')
  updateManagedUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateManagedUserDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.usersService.updateManagedUser(userId, dto, request.user);
  }

  @Patch(':userId/password')
  resetManagedUserPassword(
    @Param('userId') userId: string,
    @Body() dto: ResetManagedUserPasswordDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.usersService.resetManagedUserPassword(userId, dto, request.user);
  }
}
