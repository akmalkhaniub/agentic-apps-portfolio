import { Module } from '@nestjs/common';
import { TechnicianService } from './technician.service';

@Module({
  providers: [TechnicianService],
  exports: [TechnicianService],
})
export class TechnicianModule {}
