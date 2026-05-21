# App 8: Real Estate "Virtual Showings" Coordinator (Voice)

## Concept
An outbound voice agent that qualifies leads for new properties and answers complex neighborhood questions.

## Workflow
1.  **Lead Outreach:** Calls a list of leads from the CRM (Salesforce/HubSpot).
2.  **Property Q&A:** Uses RAG on the property's PDF brochure to answer questions about square footage, HOA fees, and school ratings.
3.  **Qualification:** Asks the lead about their budget and timeline.
4.  **Booking:** If qualified, syncs a private viewing directly into the realtor’s Google/Outlook calendar.
5.  **Handoff:** If the lead is a "Hot prospect," the agent offers to transfer the call to the realtor immediately.

## Tech Stack
- **Language:** TypeScript
- **Voice Platform:** Retell AI (Proprietary LLM-to-Voice)
- **CRM Integration:** HubSpot API
- **TTS:** ElevenLabs (Multilingual v2)
- **Vector DB:** Weaviate (for property RAG)
- **Scheduling:** Cal.com API
