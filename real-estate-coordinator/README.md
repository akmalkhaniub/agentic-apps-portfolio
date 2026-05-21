# Real Estate Virtual Showings Coordinator

An outbound voice agent built in TypeScript that qualifies real estate leads, answers property questions using RAG over listing brochures, and books private showings directly into realtor calendars.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CRM (HubSpot)                                   │
│              (Lead list with phone, budget, preferences)                  │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  Fetch qualified leads
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   OUTBOUND CALL ENGINE (Retell AI)                       │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │  STT         │   │  LLM Agent   │   │  ElevenLabs  │                │
│  │  (Retell)    │──▶│  Property    │──▶│  TTS         │                │
│  │              │   │  Q&A Agent   │   │  Multilingual│                │
│  │  Audio ▶ text│   │              │   │  v2          │                │
│  └──────────────┘   └──────┬───────┘   └──────────────┘                │
│                            │                                             │
│                            ▼                                             │
│                  ┌───────────────────┐      ┌───────────────────┐       │
│                  │  PROPERTY RAG     │      │  Weaviate         │       │
│                  │                   │◀────▶│  Vector DB        │       │
│                  │  Sq footage?      │      │                   │       │
│                  │  HOA fees?        │      │  PDF brochure     │       │
│                  │  School ratings?  │      │  embeddings       │       │
│                  │  Neighborhood?    │      │                   │       │
│                  └────────┬──────────┘      └───────────────────┘       │
│                           │                                              │
│                           ▼                                              │
│                  ┌───────────────────┐                                   │
│                  │  QUALIFICATION    │                                   │
│                  │                   │                                   │
│                  │  Budget match?    │                                   │
│                  │  Timeline?        │                                   │
│                  │  Pre-approved?    │                                   │
│                  └────────┬──────────┘                                   │
│                           │                                              │
│                ┌──────────┼──────────┐                                   │
│                ▼                     ▼                                   │
│          QUALIFIED              NOT QUALIFIED                           │
│          ┌─────────────┐        ┌──────────────┐                       │
│          │ Book showing │        │ Log to CRM   │                       │
│          │ via Cal.com  │        │ nurture list  │                       │
│          └──────┬──────┘        └──────────────┘                       │
│                 │                                                        │
│          ┌──────┼──────┐                                                │
│          ▼             ▼                                                │
│   "Hot Prospect"   Standard                                            │
│   ┌────────────┐   ┌────────────┐                                      │
│   │ Transfer   │   │ Confirm    │                                      │
│   │ call to    │   │ showing    │                                      │
│   │ realtor    │   │ via SMS    │                                      │
│   │ NOW        │   │            │                                      │
│   └────────────┘   └────────────┘                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | TypeScript | Type-safe full-stack development |
| Voice Platform | Retell AI | LLM-native outbound voice calling |
| TTS | ElevenLabs Multilingual v2 | Natural-sounding multilingual speech |
| CRM | HubSpot API | Lead management and pipeline tracking |
| Vector DB | Weaviate | RAG over property PDF brochures |
| Scheduling | Cal.com API | Calendar sync for private showings |

## Quick Start

```bash
cd real-estate-coordinator
npm install
npm run build
npm start
```

Configure via environment variables:

```bash
export RETELL_API_KEY=...
export HUBSPOT_API_KEY=...
export ELEVENLABS_API_KEY=...
export WEAVIATE_URL=http://localhost:8080
export CALCOM_API_KEY=...
```

## API Examples

### Start an outbound campaign
```bash
curl -X POST http://localhost:3000/campaigns/start \
  -H "Content-Type: application/json" \
  -d '{"list_id": "hs_list_789", "property_id": "prop_456", "max_concurrent": 5}'
```

### Check lead qualification status
```bash
curl http://localhost:3000/leads/lead_123/status
```

### Upload a property brochure for RAG
```bash
curl -X POST http://localhost:3000/properties/ingest \
  -F "brochure=@123_main_st.pdf" \
  -F "property_id=prop_456"
```

## Design Decisions

- **Retell AI over Twilio+custom**: Retell provides a native LLM-to-voice loop, avoiding the complexity of stitching together separate STT/TTS/LLM services for outbound calls.
- **Weaviate for property RAG**: Each listing brochure is chunked and embedded so the agent can answer specific questions (HOA fees, school district) without hallucinating.
- **Cal.com for scheduling**: Open-source calendar API avoids Google/Outlook vendor lock-in while supporting conflict detection and time zone handling.
- **Hot prospect live transfer**: The highest-intent leads are bridged directly to the realtor mid-call, maximizing conversion while the lead is engaged.
