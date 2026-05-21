import { Injectable } from '@nestjs/common';
import { JobService, type Job } from '../job/job.service';
import { TechnicianService, type Technician } from '../technician/technician.service';

export interface DispatchResult {
  job: Job;
  status: 'DISPATCHED' | 'NO_TECHS' | 'ALL_REJECTED';
  technician?: Technician;
  attempts: { techName: string; accepted: boolean }[];
}

@Injectable()
export class DispatchService {
  constructor(
    private jobService: JobService,
    private technicianService: TechnicianService,
  ) {}

  async handleEmergency(
    description: string,
    lat: number,
    lon: number,
    customerPhone: string,
  ): Promise<DispatchResult> {
    const job = this.jobService.create({ description, lat, lon, customerPhone });

    const technicians = this.technicianService.findNearest(lat, lon);

    if (technicians.length === 0) {
      this.jobService.updateStatus(job.id, 'failed');
      return { job, status: 'NO_TECHS', attempts: [] };
    }

    const attempts: { techName: string; accepted: boolean }[] = [];

    for (const tech of technicians) {
      const accepted = this.evaluateMatch(description, tech);
      attempts.push({ techName: tech.name, accepted });

      if (accepted) {
        this.jobService.assign(job.id, tech.id);
        this.technicianService.setAvailability(tech.id, false);
        return { job: this.jobService.findById(job.id)!, status: 'DISPATCHED', technician: tech, attempts };
      }
    }

    this.jobService.updateStatus(job.id, 'failed');
    return { job, status: 'ALL_REJECTED', attempts };
  }

  private evaluateMatch(description: string, tech: Technician): boolean {
    const desc = description.toLowerCase();
    return tech.skills.some((skill) => desc.includes(skill.replace('_', ' ')) || desc.includes(skill));
  }
}
