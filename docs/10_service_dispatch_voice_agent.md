# App 10: Dynamic "Service Dispatch" Coordinator (Voice)

## Concept
An autonomous dispatcher for home services (plumbers, electricians, locksmiths) that manages the "Confirm-and-Callback" loop.

## Workflow
1.  **Incoming Emergency:** Receives an emergency service call.
2.  **Worker Lookup:** Analyzes the location and availability of on-duty technicians.
3.  **Negotiation:** 
    - Calls the nearest technician.
    - Offers the job and provides details.
    - Technician accepts/rejects.
4.  **Customer Confirmation:** Once accepted, calls the customer back to confirm the ETA and provides the technician's name.
5.  **Tracking:** Updates the CRM and internal dispatch dashboard.

## Tech Stack
- **Language:** Node.js
- **Backend:** NestJS
- **Telephony:** Plivo (High Volume)
- **Maps:** Mapbox SDK (Geofencing)
- **Orchestration:** CrewAI (Python workers) + BullMQ (Task Queue)
- **Database:** PostgreSQL + PostGIS (for location queries)
