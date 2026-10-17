# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-10-17

### Added
- SSE streaming support for `chat/completions` in the HostYourAI chat model.
- Streaming event parsing with text-delta emission and finish chunk handling.
- Expanded streaming and transport regression tests (malformed SSE, fallback finish, array deltas, openStream errors, routing behavior).

### Changed
- Minor release bump to introduce streaming support.

### Fixed
- Automatic fallback for `hyai/auto` when `transport=body` is rejected with `422 extra_forbidden` on `body.hyai`.
- On fallback, request is retried with `X-HYAI-Task` and `X-HYAI-Policy` headers.

## [0.1.0] - 2026-10-17

### Added
- Initial community node release for HostYourAI chat model integration in n8n.
- Credential + model node with dynamic model loading and `hyai/auto` default.
- Router controls for `hyai/auto` (Task, Policy, Transport).
- Warmup retry handling for 503 responses with bounded retry/wait controls.
- README setup and usage documentation.
