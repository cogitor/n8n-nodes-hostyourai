# n8n-nodes-hostyourai

EU-hosted HostYourAI chat model node for n8n AI workflows.

This package adds a chat model node that plugs into official AI nodes such as AI Agent via ai_languageModel output, while keeping inference on HostYourAI's EU-hosted infrastructure and routing model.

## Installation

Follow the n8n community nodes installation guide:
https://docs.n8n.io/integrations/community-nodes/installation/

Package name:
n8n-nodes-hostyourai

## Included nodes

- HostYourAI Chat Model

## Credentials

Create `HostYourAI API` credentials with:
- API Key
- Base URL (default: https://hostyourai.com/api/v1)

## Node options

- Model (default: hyai/auto)
- Task: chat, code, summarise, classify, extract, rag, legal, reason
- Policy: balanced, speed, cost, quality
- Transport:
  - Body (`hyai: { task, policy }`)
  - Headers (`X-HYAI-Task`, `X-HYAI-Policy`)
- Cold-start retry controls
- Note: Task/Policy/Transport apply only when `Model = hyai/auto`

## Notes

- Designed for OpenAI-compatible `/chat/completions` behavior.
- Handles HostYourAI warm-up responses (503 with retry headers) using bounded retries.

## Resources

- Official HostYourAI docs (canonical, most up to date): https://hostyourai.com/app/docs
- HostYourAI API base URL used by this node: https://hostyourai.com/api/v1
- n8n community nodes docs: https://docs.n8n.io/integrations/#community-nodes
- Bug reports for this node: https://github.com/cogitor/n8n-nodes-hostyourai/issues
