import { Controller, Get, Query } from '@nestjs/common';
import { TechnicianService } from './technician.service';

@Controller('technicians')
export class TechnicianController {
  constructor(private readonly technicianService: TechnicianService) {}

  @Get()
  listAll() {
    return this.technicianService.findAll();
  }

  @Get('nearest')
  getNearest(@Query('lat') lat: string, @Query('lon') lon: string) {
    return this.technicianService.findNearest(parseFloat(lat), parseFloat(lon));
  }
}
