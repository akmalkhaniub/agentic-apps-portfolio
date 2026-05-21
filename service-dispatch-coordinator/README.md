# Service Dispatch Coordinator

An autonomous voice dispatcher for home services (plumbers, electricians, locksmiths) that receives emergency calls, finds the nearest available technician, negotiates job acceptance, and confirms ETAs with customers.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      INCOMING EMERGENCY CALL                             │
│                  (Customer reports broken pipe, etc.)                     │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  Inbound via Plivo
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      NESTJS BACKEND                                      │
│                                                                          │
│  POST /calls/inbound      — receive emergency call webhook               │
│  POST /dispatch/assign    — manually assign a technician                 │
│  GET  /dispatch/:id       — check dispatch status                        │
│  GET  /technicians/nearby — find available workers                       │
│                                                                          │
│         ┌───────────────────────────────────────────┐                   │
│         │           DISPATCH ORCHESTRATOR            │                   │
│         │           (CrewAI + BullMQ)                │                   │
│         │                                            │                   │
│         │  1. Parse emergency details                │                   │
│         │  2. Geoquery for nearest techs             │                   │
│         │  3. Enqueue outbound call jobs              │                   │
│         └──────────────────┬─────────────────────────┘                  │
│                            │                                             │
│              ┌─────────────┼─────────────┐                              │
│              ▼             ▼             ▼                              │
│     ┌──────────────┐ ┌──────────┐ ┌──────────────┐                     │
│     │  PostgreSQL  │ │  Mapbox  │ │  BullMQ      │                     │
│     │  + PostGIS   │ │  SDK     │ │  Task Queue  │                     │
│     │              │ │          │ │              │                     │
│     │  Technician  │ │  Nearest │ │  Outbound    │                     │
│     │  locations   │ │  match + │ │  call jobs   │                     │
│     │  schedules   │ │  ETA     │ │  (ordered)   │                     │
│     └──────────────┘ └──────────┘ └──────┬───────┘                     │
│                                          │                              │
│                                          ▼                              │
│                               ┌───────────────────┐                    │
│                               │  TECHNICIAN CALL   │                    │
│                               │  (Plivo outbound)  │                    │
│                               │                    │                    │
│                               │  "Burst pipe at    │                    │
│                               │   123 Main St.     │                    │
│                               │   Accept? Y/N"     │                    │
│                               └────────┬───────────┘                   │
│                                        │                                │
│                             ┌──────────┼──────────┐                    │
│                             ▼                     ▼                    │
│                        ACCEPTED               REJECTED                 │
│                        ┌────────────┐         ┌────────────┐           │
│                        │ Call back  │         │ Try next   │           │
│                        │ customer   │         │ technician │           │
│                        │ with ETA   │         │ in queue   │           │
│                        └─────┬──────┘         └────────────┘           │
│                              │                                          │
│                              ▼                                          │
│                   ┌───────────────────┐                                 │
│                   │  CUSTOMER CONFIRM │                                 │
│                   │                   │                                 │
│                   │  "John P. is on   │                                 │
│                   │   the way. ETA    │                                 │
│                   │   25 min."        │                                 │
│                   └────────┬──────────┘                                │
│                            │                                            │
│                            ▼                                            │
│                   ┌───────────────────┐                                 │
│                   │  UPDATE CRM +     │                                 │
│                   │  DISPATCH BOARD   │                                 │
│                   └───────────────────┘                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Node.js / TypeScript | Event-driven async I/O for concurrent calls |
| Backend | NestJS | Modular framework with dependency injection |
| Telephony | Plivo | High-volume inbound/outbound voice calls |
| Geolocation | Mapbox SDK | Geofencing and ETA calculation |
| Task Queue | BullMQ | Ordered outbound call job processing |
| Agent Logic | CrewAI (Python workers) | Multi-step dispatch reasoning |
| Database | PostgreSQL + PostGIS | Spatial queries for technician proximity |

## Quick Start

```bash
cd service-dispatch-coordinator
npm install
npm run build
npm run start:dev
```

The NestJS server starts on port 3000. Configure external services:

```bash
export PLIVO_AUTH_ID=...
export PLIVO_AUTH_TOKEN=...
export MAPBOX_ACCESS_TOKEN=...
export DATABASE_URL=postgresql://localhost:5432/dispatch
export REDIS_URL=redis://localhost:6379
```

## API Examples

### Receive an inbound emergency call
```bash
curl -X POST http://localhost:3000/calls/inbound \
  -H "Content-Type: application/json" \
  -d '{"caller": "+15551234567", "issue": "burst pipe", "address": "123 Main St, Austin TX"}'
```

### Find nearby technicians
```bash
curl "http://localhost:3000/technicians/nearby?lat=30.267&lng=-97.743&radius_km=15&specialty=plumber"
```

### Check dispatch status
```bash
curl http://localhost:3000/dispatch/DSP-789
```

## Design Decisions

- **PostGIS spatial queries**: `ST_DWithin` finds technicians within a radius in milliseconds, far more efficient than application-level distance filtering.
- **BullMQ ordered queue**: Technicians are called one at a time in priority order (nearest first). If one rejects, the next job fires automatically without race conditions.
- **Plivo over Twilio**: Plivo offers better per-minute pricing at high call volumes, which matters for a dispatch service handling hundreds of daily calls.
- **CrewAI for reasoning**: The dispatch decision (which tech, what priority, escalation rules) runs in Python CrewAI workers, keeping the Node.js layer focused on I/O and telephony.
