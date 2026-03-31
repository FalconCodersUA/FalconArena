import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ErrorReportsController } from './error-reports.controller';
import { ErrorReportsService } from './error-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [ErrorReportsController],
  providers: [ErrorReportsService],
  exports: [ErrorReportsService],
})
export class ErrorReportsModule {}
