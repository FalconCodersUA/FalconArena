import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationRulesDto {
  @IsOptional()
  @IsBoolean()
  registrationStarted?: boolean;

  @IsOptional()
  @IsBoolean()
  roundStarted?: boolean;

  @IsOptional()
  @IsBoolean()
  submissionReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  deadlineReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  submissionClosed?: boolean;
}
