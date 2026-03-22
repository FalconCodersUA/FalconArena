import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthUser } from './common/types/auth-user.type';
import {
  CreateDirectDialogDto,
  SendDirectMessageDto,
} from './direct-messages.dto';
import { DirectMessagesService } from './direct-messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(private readonly directMessagesService: DirectMessagesService) {}

  @Get('dialogs')
  listDialogs(@Req() request: { user: AuthUser }) {
    return this.directMessagesService.listDialogs(request.user.userId);
  }

  @Post('dialogs')
  createDialog(
    @Req() request: { user: AuthUser },
    @Body() dto: CreateDirectDialogDto,
  ) {
    return this.directMessagesService.createOrGetDialog(
      request.user.userId,
      dto.recipientEmail,
    );
  }

  @Get('dialogs/:id')
  getDialog(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.directMessagesService.getDialogWithMessages(
      request.user.userId,
      id,
    );
  }

  @Post('dialogs/:id')
  sendMessage(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    return this.directMessagesService.sendMessage(
      request.user.userId,
      id,
      dto.body,
    );
  }
}
