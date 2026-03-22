import { IsEmail, IsString, Length } from 'class-validator';

export class CreateDirectDialogDto {
  @IsEmail()
  recipientEmail!: string;
}

export class SendDirectMessageDto {
  @IsString()
  @Length(1, 2000)
  body!: string;
}
