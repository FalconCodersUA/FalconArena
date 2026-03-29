import { IsIn, IsOptional } from 'class-validator';

export class CertificateQueryDto {
  @IsOptional()
  @IsIn(['participation', 'winner'])
  kind?: 'participation' | 'winner';
}
