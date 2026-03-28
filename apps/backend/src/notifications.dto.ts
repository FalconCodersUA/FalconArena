import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class MarkNotificationsReadDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  notificationIds?: string[];
}
