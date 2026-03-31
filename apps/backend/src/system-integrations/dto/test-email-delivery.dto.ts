import { IsEmail } from 'class-validator';

export class TestEmailDeliveryDto {
  @IsEmail()
  recipientEmail!: string;
}
