# ADR 0001: Repo-specific implementation decisions

Status: Accepted
Date: 2026-10-17

## Context

This repository already follows official n8n community-node guidance and project-level agent docs.
This ADR records only decisions that are specific to this package and not generic n8n best practices.

## Decisions

### 1) Fixed HostYourAI base URL

Decision:
- Use a fixed API base URL in node/runtime code: `https://hostyourai.com/api/v1`
- Do not expose a user-editable Base URL field in credentials.

Why:
- Reduces complexity and support surface.
- Avoids config drift between credential UI, runtime requests, and model loading.
- Removes unnecessary URL-validation/SSRF-risk surface for this package.

### 2) Compatibility fallback for `hyai` routing hints

Decision:
- Default transport can send `hyai` hints in request body.
- If provider returns deterministic schema rejection (`422 extra_forbidden` on `body.hyai`), retry once using `X-HYAI-*` headers.

Why:
- Preserves compatibility across backend variants with different schema enforcement.
- Keeps behavior resilient without requiring user intervention.

### 3) Stream and non-stream parity for reliability logic

Decision:
- `generate()` and `stream()` must share the same retry/fallback behavior:
  - 503 warmup retry handling
  - 422 body-to-header fallback handling

Why:
- Avoids mode-specific bugs where streaming behaves differently from non-stream calls.
- Keeps operational behavior predictable for users.

## Consequences

- Lower configuration flexibility by design (fixed endpoint).
- More robust runtime behavior under provider schema/warmup variability.
- Tests must continue to cover fallback/retry parity in both stream and non-stream paths.

## Out of scope

- Generic n8n community-node requirements and release best practices.
- Those remain in official n8n docs and existing repo agent guidance.
