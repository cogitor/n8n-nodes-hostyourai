# n8n-nodes-hostyourai

A [HostYourAI](https://hostyourai.com) Chat Model for n8n AI workflows.

This community package adds one AI Language Model node:

- HostYourAI Chat Model

Use it in AI Agent and other n8n AI pipelines through the `ai_languageModel` output.

## Why HostYourAI?

### EU Sovereign hosting of openweight LLM models

- Enable "EU only" on a key to enforce sovereign routing.
- This is configured in HostYourAI's key-level setting, then used by this node.

Read more: [EU Inference Router](https://hostyourai.com/en/service/eu-inference-router)

### Automatic model choice with parameter-based optimization

- Use the `hyai/auto` model option to automatically select an available warm model.
- You can steer optimization with Task + Policy parameters.
- Parameter details are documented below in [Node parameters](./#node-parameters).

Read more: [HostYourAI docs (auto mode)](https://hostyourai.com/app/docs)

### Bring your own model

- You can run any open model from the model catalog, or host dedicated/own models from HuggingFace.

Read more: [Dedicated GPU instances (bring your own model)](https://hostyourai.com/en/service/dedicated-gpu-instances)

## Why this node?

[HostYourAI](https://hostyourai.com) is OpenAI-compatible, so you can use it without a separate node. You can configure the URL and the API keys as a drop-in replacement for OpenAI-style integrations (same `/chat/completions` shape, different base URL + key).

To make things easy out-of-box, this node is already pre-configured to use the HostYourAI host URL and allows you to use the Auto router mode (`hyai/auto`) to let HostYourAI select an optimised model for each request.

## Installation

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

Then restart n8n. After restart, search for "HostYourAI Chat Model" in the node panel.

Further reference on community-node installations can be found [here](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials setup (HostYourAI API)

Create a credential of type `HostYourAI API` in n8n and set API Key.

How to get key:

1. Log in to [HostYourAI](https://hostyourai.com/app/dashboard).
2. Open [API keys](https://hostyourai.com/app/api-keys).
3. Create a key.
4. Enable "EU only" on that key if required.
5. Copy the key to n8n

This node sends your API key as a Bearer token in the Authorization header.

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

## Usage with AI Agent

1. Add AI Agent node.
2. Add HostYourAI Chat Model node.
3. Connect HostYourAI Chat Model to AI Agent model input.
4. Select credentials, then choose fixed model or `hyai/auto`.
5. If using `hyai/auto`, set Task and Policy.

## Troubleshooting

- Credential test fails
  - Re-check API key value.
  - Confirm key is active in HostYourAI API keys page.

## References

- HostYourAI FAQ (OpenAI compatibility, API key/base URL, Sovereignty Mode, hyai/auto): https://hostyourai.com/faq
- HostYourAI OpenAI-compatible API page: https://hostyourai.com/en/service/openai-compatible-api
- HostYourAI Management API docs: https://hostyourai.com/docs/management-api
- HostYourAI model catalog: https://hostyourai.com/models
- n8n community node install docs: https://docs.n8n.io/integrations/community-nodes/installation/

## License

[MIT](./LICENSE)
