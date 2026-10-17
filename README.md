# n8n-nodes-hostyourai

HostYourAI Chat Model for n8n AI workflows.

This community package adds one AI Language Model node:

- HostYourAI Chat Model

It is built for HostYourAI's OpenAI-compatible router endpoint and plugs into n8n AI nodes (for example AI Agent) through the `ai_languageModel` output.

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

How to get the API key and base URL (from HostYourAI docs/FAQ):

1. Log in to HostYourAI.
2. Open API keys: `https://hostyourai.com/app/api-keys`
3. Create a key.
4. Use the shown base URL (normally `https://hostyourai.com/api/v1`).

This node sends your API key in the HTTP Authorization header.

Notes:

- Base URL must be HTTPS.
- Base URL host must be `hostyourai.com` or a subdomain of it.
- Credential test calls `GET /models` on the configured base URL.

## Node behavior

The node sends requests to:

- `POST /chat/completions`

and returns a standard chat-model output for n8n AI pipelines.

Model discovery in the Model field uses:

- `GET /models`

If model loading fails, the node still offers a safe fallback model: `hyai/auto`.

## Node parameters

### Model Name or ID

Default: `hyai/auto`

- Loads available model IDs from HostYourAI `/models`.
- You can also provide a model ID via expression.

### Options

#### Sampling Temperature

Default: `0.7`
Range: `0.0` to `2.0`

Controls randomness in model output.

#### Task

Default: `chat`
Values: `chat`, `code`, `summarise`, `classify`, `extract`, `rag`, `legal`, `reason`

Routing hint for HostYourAI router.

Important: this is applied only when Model is `hyai/auto`.

#### Policy

Default: `balanced`
Values: `balanced`, `speed`, `cost`, `quality`

Routing policy for HostYourAI router.

Important: this is applied only when Model is `hyai/auto`.

#### Transport

Default: `body`
Values:

- `body` -> sends `task` and `policy` in JSON as `hyai: { task, policy }`
- `headers` -> sends `X-HYAI-Task` and `X-HYAI-Policy`

Important: this is applied only when Model is `hyai/auto`.

#### Max Cold-Start Retries

Default: `4`
Range: `0` to `30`

When HostYourAI returns HTTP 503 (warm-up), the node retries up to this limit.

#### Max Cold-Start Wait (Seconds)

Default: `90`
Range: `1` to `600`

Maximum cumulative wait budget for warm-up retries.

The node honors retry hints from `Retry-After` and `X-HYAI-ETA-Seconds` when present.

## Usage with AI Agent

1. Add AI Agent node.
2. Add HostYourAI Chat Model node.
3. Connect HostYourAI Chat Model to AI Agent model input.
4. Select credentials and model/options.

## Limitations

- Streaming is not implemented in this node yet.
- Use non-streaming mode.

## Troubleshooting

- "Invalid Base URL":
  - Ensure HTTPS.
  - Ensure host is `hostyourai.com` (or subdomain).
- Credential test fails:
  - Re-check API key value.
  - Re-check Base URL (`https://hostyourai.com/api/v1`).
  - Confirm key is active in HostYourAI API keys page.
- Model list does not load:
  - Node will fall back to `hyai/auto`; you can still run requests.

## Links

- HostYourAI FAQ (API key and base URL): https://hostyourai.com/faq
- HostYourAI Management API docs: https://hostyourai.com/docs/management-api
- HostYourAI OpenAI-compatible API page: https://hostyourai.com/en/service/openai-compatible-api
- HostYourAI model catalog: https://hostyourai.com/models
- n8n community node install docs: https://docs.n8n.io/integrations/community-nodes/installation/

## License

MIT