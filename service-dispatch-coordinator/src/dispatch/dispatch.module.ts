import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JobModule } from '../job/job.module';
import { TechnicianModule } from '../technician/technician.module';
import { JobController } from '../job/job.controller';

@Module({
  imports: [JobModule, TechnicianModule],
  providers: [DispatchService],
  controllers: [JobController],
  exports: [DispatchService],
})
export class DispatchModule {}
