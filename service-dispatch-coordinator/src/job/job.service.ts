import { Injectable } from '@nestjs/common';

export interface Job {
  id: string;
  description: string;
  lat: number;
  lon: number;
  customerPhone: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assignedTechId?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class JobService {
  private jobs = new Map<string, Job>();

  create(data: { description: string; lat: number; lon: number; customerPhone: string }): Job {
    const job: Job = {
      id: 'JOB-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      ...data,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  assign(jobId: string, techId: string): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.status = 'assigned';
    job.assignedTechId = techId;
    job.updatedAt = new Date();
    return job;
  }

  updateStatus(jobId: string, status: Job['status']): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.status = status;
    job.updatedAt = new Date();
    return job;
  }

  findById(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  findAll(): Job[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
