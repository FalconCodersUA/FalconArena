import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listManagedUsers() {
    return this.usersService.listManagedUsers();
  }

  @Patch(':userId')
  updateManagedUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateManagedUserDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.usersService.updateManagedUser(userId, dto, request.user);
  }
}
