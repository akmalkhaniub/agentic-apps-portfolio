import { Module } from '@nestjs/common';
import { DispatchModule } from './dispatch/dispatch.module';
import { TechnicianModule } from './technician/technician.module';
import { JobModule } from './job/job.module';

@Module({
  imports: [DispatchModule, TechnicianModule, JobModule],
})
export class AppModule {}
