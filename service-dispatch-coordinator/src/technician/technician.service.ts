import { Injectable, OnModuleInit } from '@nestjs/common';

export interface Technician {
  id: string;
  name: string;
  phone: string;
  skills: string[];
  latitude: number;
  longitude: number;
  isAvailable: boolean;
}

@Injectable()
export class TechnicianService implements OnModuleInit {
  private technicians = new Map<string, Technician>();

  onModuleInit() {
    const seed: Omit<Technician, 'id'>[] = [
      { name: 'Mike Torres', phone: '+1-555-0101', skills: ['plumbing', 'water_heater'], latitude: 40.7128, longitude: -74.006, isAvailable: true },
      { name: 'Sarah Kim', phone: '+1-555-0102', skills: ['electrical', 'hvac'], latitude: 40.7282, longitude: -73.7949, isAvailable: true },
      { name: 'James Okafor', phone: '+1-555-0103', skills: ['plumbing', 'gas_line'], latitude: 40.6892, longitude: -74.0445, isAvailable: true },
      { name: 'Lisa Patel', phone: '+1-555-0104', skills: ['hvac', 'electrical', 'appliance'], latitude: 40.7589, longitude: -73.9851, isAvailable: false },
      { name: 'Carlos Ruiz', phone: '+1-555-0105', skills: ['locksmith', 'security'], latitude: 40.7484, longitude: -73.9857, isAvailable: true },
      { name: 'Nina Zhao', phone: '+1-555-0106', skills: ['plumbing', 'appliance', 'hvac'], latitude: 40.7061, longitude: -74.0089, isAvailable: true },
    ];

    for (const t of seed) {
      const id = 'TECH-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      this.technicians.set(id, { id, ...t });
    }
  }

  findNearest(lat: number, lon: number, limit = 5): Technician[] {
    return Array.from(this.technicians.values())
      .filter((t) => t.isAvailable)
      .map((t) => ({
        ...t,
        distance: haversine(lat, lon, t.latitude, t.longitude),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  findById(id: string): Technician | undefined {
    return this.technicians.get(id);
  }

  findAll(): Technician[] {
    return Array.from(this.technicians.values());
  }

  setAvailability(id: string, available: boolean): Technician | null {
    const tech = this.technicians.get(id);
    if (!tech) return null;
    tech.isAvailable = available;
    return tech;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
