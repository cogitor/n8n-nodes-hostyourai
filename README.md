# n8n-nodes-hostyourai

Official HostYourAI site: https://hostyourai.com

HostYourAI Chat Model for n8n AI workflows.

This community package adds one AI Language Model node:

- HostYourAI Chat Model

Use it in AI Agent and other n8n AI pipelines through the `ai_languageModel` output.

## Why this node

HostYourAI is OpenAI-compatible, so you can use it as a drop-in replacement for OpenAI-style integrations (same `/chat/completions` shape, different base URL + key).

This node gives you both paths in one place:

- pin a specific open-weight model from `/models`
- or use `hyai/auto` router mode and let HostYourAI select a model for each request

## Two key HostYourAI features (important)

### 1) Sovereignty Mode per API key ("EU only")

HostYourAI lets you enforce fully European routing per key via the "EU only" switch (Sovereignty Mode).

Practical impact:

- Create/select the API key in HostYourAI (`https://hostyourai.com/app/api-keys`)
- Enable "EU only" on that key when you need strict sovereign routing
- Use that key in this n8n credential

So policy is attached to the key, not implemented in this node.

### 2) `hyai/auto` router with task + policy optimization

When you set Model to `hyai/auto`, HostYourAI router selects a model automatically.

In this node, you can steer routing with:

- Policy: `balanced` (default), `cost`, `speed`, `quality`
- Task: `chat` (default), `code`, `summarise`, `classify`, `extract`, `rag`, `legal`, `reason`

This lets you optimize for your use case without pinning a single model ID.

Note: Task and Policy are applied only when Model = `hyai/auto`.

## Installation

Community nodes are available on self-hosted n8n.

From the n8n UI:

1. Go to Settings -> Community Nodes.
2. Select Install.
3. Enter package name: `n8n-nodes-hostyourai`
4. Confirm installation.
5. Restart n8n (or your container/service) if your setup does not auto-reload community packages.

Manual install:

```bash
cd ~/.n8n/nodes
npm i n8n-nodes-hostyourai
```

Then restart n8n.

After restart, search for "HostYourAI Chat Model" in the node panel.

Reference for community-node install behavior:
https://docs.n8n.io/integrations/community-nodes/installation/

## Credentials setup (HostYourAI API)

Create a credential of type `HostYourAI API` in n8n and set:

- API Key
- Base URL (default: `https://hostyourai.com/api/v1`)

How to get key + base URL:

1. Log in to HostYourAI.
2. Open API keys: `https://hostyourai.com/app/api-keys`
3. Create a key.
4. Copy the shown base URL (normally `https://hostyourai.com/api/v1`).
5. Optional but important: enable "EU only" on that key if required.

This node sends your API key as a Bearer token in the Authorization header.

Validation and test behavior:

- Base URL must be HTTPS.
- Base URL host must be `hostyourai.com` or a subdomain.
- Credential test calls `GET /models` on the configured base URL.

## Node behavior

The node uses OpenAI-compatible endpoints:

- `GET /models` (model picker)
- `POST /chat/completions` (inference)

If model loading fails, the Model field still offers fallback `hyai/auto`.

For warm-up responses, the node handles HTTP 503 with bounded retries.

## Node parameters

Important:

- Task, Policy, and Transport apply only when Model = `hyai/auto`.

| Parameter | Default | Allowed values / range | Applies when | What it does |
|---|---|---|---|---|
| Model Name or ID | `hyai/auto` | Any model ID returned by `/models` (expression input supported) | Always | Selects fixed model or router mode (`hyai/auto`). |
| Sampling Temperature | `0.7` | `0.0` to `2.0` | Always | Controls output randomness. |
| Task | `chat` | `chat`, `code`, `summarise`, `classify`, `extract`, `rag`, `legal`, `reason` | Model = `hyai/auto` | Routing hint for use-case intent. |
| Policy | `balanced` | `balanced`, `speed`, `cost`, `quality` | Model = `hyai/auto` | Optimizes router behavior for speed/cost/quality balance. |
| Transport | `body` | `body`, `headers` | Model = `hyai/auto` | Sends task/policy in JSON (`hyai`) or headers (`X-HYAI-*`). |
| Max Cold-Start Retries | `4` | `0` to `30` | Always | Retry count for HTTP 503 warm-up responses. |
| Max Cold-Start Wait (Seconds) | `90` | `1` to `600` | Always | Maximum cumulative warm-up wait budget. |

Retry behavior notes:

- Warm-up retry hints are read from `Retry-After` and `X-HYAI-ETA-Seconds`.
- If wait budget is exhausted, the request fails with a warm-up error.

Quick decision guide:

- Want predictable behavior from one model -> choose a fixed model ID.
- Want automatic routing across warm models -> choose `hyai/auto`, then set Task + Policy.

## Quick usage patterns

### A) Drop-in OpenAI-style usage

- Use your HostYourAI key + base URL
- Pick a concrete model from Model list
- Keep your existing AI workflow shape

### B) Router-optimized usage (`hyai/auto`)

- Set Model to `hyai/auto`
- Pick Task and Policy
- Let HostYourAI choose the model per request

## Usage with AI Agent

1. Add AI Agent node.
2. Add HostYourAI Chat Model node.
3. Connect HostYourAI Chat Model to AI Agent model input.
4. Select credentials, then choose fixed model or `hyai/auto`.
5. If using `hyai/auto`, set Task and Policy.

## Limitations

- Streaming is not implemented in this node yet.
- Use non-streaming mode.

## Troubleshooting

- "Invalid Base URL"
  - Ensure HTTPS.
  - Ensure host is `hostyourai.com` (or subdomain).
- Credential test fails
  - Re-check API key value.
  - Re-check Base URL (`https://hostyourai.com/api/v1`).
  - Confirm key is active in HostYourAI API keys page.
- Model list does not load
  - Node falls back to `hyai/auto`; requests can still run.
- `hyai/auto` settings seem ignored
  - Confirm Model is exactly `hyai/auto`.

## References

- HostYourAI FAQ (OpenAI compatibility, API key/base URL, Sovereignty Mode, hyai/auto): https://hostyourai.com/faq
- HostYourAI OpenAI-compatible API page: https://hostyourai.com/en/service/openai-compatible-api
- HostYourAI Management API docs: https://hostyourai.com/docs/management-api
- HostYourAI model catalog: https://hostyourai.com/models
- n8n community node install docs: https://docs.n8n.io/integrations/community-nodes/installation/

## License

MIT