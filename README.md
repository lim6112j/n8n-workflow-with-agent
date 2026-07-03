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

## Files
- `user-intention-fixer.workflow.json`: local source of truth for workflow definition.
- `AGENT.md`: authoring rules and API workflow conventions.
