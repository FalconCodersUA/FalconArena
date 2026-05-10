import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetManagedUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
