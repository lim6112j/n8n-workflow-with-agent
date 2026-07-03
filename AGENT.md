# AGENT.md

## Purpose
Use this repository to create and manage n8n workflows via the n8n HTTP API.
Target server is a Dockerized n8n instance exposed at `http://localhost:5678`.

## Default environment
- `N8N_BASE_URL=http://localhost:5678`
- `N8N_API_BASE=$N8N_BASE_URL/api/v1`
- `N8N_API_KEY={{N8N_API_KEY}}` (create in n8n UI: Settings → API Keys)

Never print or commit real API keys.

## Required API header
All authenticated API calls must include:
- `X-N8N-API-KEY: $N8N_API_KEY`
- `Content-Type: application/json`

## Connectivity checks
Run these before creating workflows:

```bash
curl -sS "$N8N_BASE_URL/healthz"
curl -sS "$N8N_API_BASE/workflows?limit=1" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"
```

## Workflow authoring rules
1. Create workflows as JSON first, then POST to API.
2. Start with `"active": false` unless explicitly requested.
3. Keep node names stable and descriptive.
4. Use n8n expression syntax for mappings, e.g. `={{$json.fieldName}}`.
5. Do not hardcode secrets in node parameters; use n8n credentials.
6. Add a short description in workflow metadata when practical.

## AI agent policy
- When a workflow needs AI-agent/LLM logic, use the **OpenRouter node in n8n**.
- Always authenticate via **n8n Credentials** configured for OpenRouter.
- Do not embed API keys in JSON/code nodes.
- Prefer a named credential reference in the node instead of raw headers.

## Minimal workflow JSON shape
Each workflow should include:
- `name`
- `nodes[]`
- `connections`
- `settings` (optional but recommended)
- `active` (boolean)

Each node should include:
- `id`
- `name`
- `type`
- `typeVersion`
- `position`
- `parameters`

## API operations

### Create workflow
```bash
curl -sS -X POST "$N8N_API_BASE/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @workflow.json
```

### List workflows
```bash
curl -sS "$N8N_API_BASE/workflows?limit=100" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"
```

### Get workflow by ID
```bash
curl -sS "$N8N_API_BASE/workflows/<workflowId>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"
```

### Update workflow
```bash
curl -sS -X PATCH "$N8N_API_BASE/workflows/<workflowId>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @workflow-update.json
```

### Activate / deactivate workflow
```bash
# activate
curl -sS -X PATCH "$N8N_API_BASE/workflows/<workflowId>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"active":true}'

# deactivate
curl -sS -X PATCH "$N8N_API_BASE/workflows/<workflowId>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"active":false}'
```

### Delete workflow
```bash
curl -sS -X DELETE "$N8N_API_BASE/workflows/<workflowId>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"
```

## Docker notes
- n8n is expected to be reachable on `localhost:5678`.
- If needed, inspect container:
  - `docker ps`
  - `docker exec -it n8n /bin/sh`

## Delivery checklist
For each workflow change:
1. Save JSON payload in this repo.
2. Validate API connectivity.
3. Create/update workflow via API.
4. Verify workflow exists and expected `active` state is correct.
5. Document workflow ID and purpose in commit/PR notes.
