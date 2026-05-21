import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { JobService } from './job.service';
import { TechnicianService } from '../technician/technician.service';

@Controller()
export class JobController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly jobService: JobService,
    private readonly technicianService: TechnicianService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'service-dispatch-coordinator' };
  }

  @Post('jobs/emergency')
  async createEmergencyJob(
    @Body() body: { description: string; lat: number; lon: number; customerPhone: string },
  ) {
    return this.dispatchService.handleEmergency(body.description, body.lat, body.lon, body.customerPhone);
  }

  @Get('jobs')
  listJobs() {
    return this.jobService.findAll();
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.jobService.findById(id) ?? { error: 'Job not found' };
  }

  @Get('technicians')
  listTechnicians() {
    return this.technicianService.findAll();
  }

  @Get('technicians/nearest')
  findNearest(@Body() body: { lat: number; lon: number }) {
    return this.technicianService.findNearest(body.lat, body.lon);
  }
}
