import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  const techs = [
    { name: "John Plumber", phone: "555-0101", skills: ["Plumbing"], latitude: 40.7128, longitude: -74.0060 }, // NYC
    { name: "Alice Electric", phone: "555-0202", skills: ["Electrical"], latitude: 40.7306, longitude: -73.9352 }, // Brooklyn
    { name: "Bob Locksmith", phone: "555-0303", skills: ["Locksmith"], latitude: 40.7580, longitude: -73.9855 }, // Times Square
  ];

  console.log("🌱 Seeding Technicians (Direct Prisma)...");
  for (const tech of techs) {
    await prisma.$executeRaw`
      INSERT INTO "Technician" (id, name, phone, skills, location, "updatedAt")
      VALUES (
        ${Math.random().toString(36).substring(7)}, 
        ${tech.name}, 
        ${tech.phone}, 
        ${tech.skills}, 
        ST_SetSRID(ST_MakePoint(${tech.longitude}, ${tech.latitude}), 4326),
        NOW()
      )
    `;
    console.log(`Added ${tech.name}`);
  }

  await prisma.$disconnect();
}

seed().catch(console.error);
