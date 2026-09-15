# n8n Workflows

This project stores n8n workflow definitions and agent rules for local development against a Dockerized n8n server.

## Environment
- n8n URL: `http://localhost:5678`
- API base: `http://localhost:5678/api/v1`
- Workflow endpoint (this project): `POST /webhook/user-intention-fixer`

## User Intention Fixer (Hybrid)
Workflow name: `user intention fixer`

The workflow uses a hybrid architecture:
1. **Rules-first validation** checks if user intent is already clear.
2. If rules are uncertain, it routes to an **AI fallback**.
3. AI fallback uses **OpenRouter node with n8n credentials** (no raw API keys in code).
4. The workflow either:
   - returns `ready_for_processing`, or
   - returns `need_clarification` with a follow-up question.

## Current Node Flow
1. `Intention Input` (Webhook)
2. `Normalize Input` (Set)
3. `Rule Intention Gate` (Code)
4. `Rules say clear?` (IF)
   - **true** → `Proceed Next Node` → `Return Processing Payload`
   - **false** → `AI Clarifier Agent` (LangChain Agent)
     - model from `OpenRouter Model` (`@n8n/n8n-nodes-langchain.lmChatOpenRouter`)
     - parsed by `Parse AI Clarifier`
     - then `AI says clear?` (IF)
       - **true** → `Proceed Next Node` → `Return Processing Payload`
       - **false** → `Ask Clarification`

## Response Contract

### When clear
```json
{
  "status": "ready_for_processing",
  "intent": "<final intent>",
  "processing_payload": { "prompt": "<final intent>" }
}
```

### When unclear
```json
{
  "status": "need_clarification",
  "question": "<follow-up question>",
  "missing_fields": ["..."]
}
```

## Testing
Example production webhook test:

```bash
curl -sS -X POST "http://localhost:5678/webhook/user-intention-fixer" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"Build an automation that ingests daily Shopify orders CSV from S3 and returns JSON summary by category"}'
```

## Film Project Setup UI

A static web form (`web/index.html`) for creating film projects via `film-01-project-setup.workflow.json`.

```bash
python3 -m http.server 8080 --directory web
# open http://localhost:8080/
```

Contract (enforced both client- and server-side):
- `film_title` — required
- `story` — required, at least 20 characters
- Reference images — 1–6 files, jpg/jpeg/png/webp, sent as form fields `image_1`…`image_6` (order = ref order)

Notes:
- **Only the first 3 refs are used** for shot generation (film-03 caps `input_references` at 3 for OpenRouter). The form badges images 4+ as "unused in shots".
- The webhook nodes of all five film workflows have `allowedOrigins: "*"` so the page can POST cross-origin; n8n only sends CORS headers when the request carries an `Origin` header.
- Server-side validation failures return n8n's generic `{"message":"Error in workflow"}` — the precise messages ("Film Title is required.", etc.) come from the form's client-side validation.
- Requires the film workflows to be active in n8n.

### Pipeline buttons

After a project is created, the page shows a **Pipeline** card with the slug filled in automatically:

1. **Generate script** → `POST /webhook/film-run-script` (`{project_slug}`) — shows `shotCount` and script path
2. **Generate shot images** → `POST /webhook/film-gen-shots` — appears when the script finishes
3. **Generate voiceover** → `POST /webhook/film-gen-voice` — appears when shots finish
4. **Assemble final film** → `POST /webhook/film-assemble` — shows `filmPath`, duration, size, and a **⬇ Download film.mp4** button

The download button hits `GET /webhook/film-download?slug=<slug>` (`film-download.workflow.json`), which streams the rendered `film.mp4` out of the n8n container as `video/mp4` with `Content-Disposition: attachment; filename="film.mp4"`. Only shown after assembly succeeds; requesting a slug with no rendered film returns an empty response (the UI never links to it in that state).

Each next button unlocks only when the previous stage completes; failed stages offer Retry. Shots/voiceover are idempotent (already-generated files are skipped unless `regen_ids` is passed — use curl for selective regeneration).

## Files
- `user-intention-fixer.workflow.json`: local source of truth for workflow definition.
- `film-0*.workflow.json`: AI film pipeline (setup → script → shots → voiceover → assemble).
- `film-download.workflow.json`: serves the rendered `film.mp4` for download (`GET /webhook/film-download?slug=...`, workflow ID `MewzwAdmqjhPoRAM`).
- `web/index.html`: project setup web form (see "Film Project Setup UI").
- `AGENT.md`: authoring rules and API workflow conventions.
