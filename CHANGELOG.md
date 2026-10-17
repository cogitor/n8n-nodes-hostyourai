# Changelog

All notable changes to this project are documented in this file.

## [0.2.3] - 2026-10-17

### Changed
- Added EU flag emoji in README sovereign-hosting section heading.
- Aligned npm provenance settings with npm guidance for third-party release tooling.
- Added `publishConfig.provenance=true` in `package.json` and `NPM_CONFIG_PROVENANCE=true` in publish workflow.

## [0.2.2] - 2026-10-17

### Changed
- Adjusted publish workflow for scoped package release to run `npm run release` with explicit `npm config set access public`.
- Keeps n8n release flow (`n8n-node release`) while enforcing public access for scoped npm publish.

## [0.2.1] - 2026-10-17

### Changed
- Renamed npm package to scoped name `@cogitor/n8n-nodes-hostyourai` before first publish.
- Updated installation docs, node metadata JSON, and lock/package manifests to use the scoped package name.
- Updated publish workflow for scoped-package first publish using explicit `npm publish --access public --provenance`.

## [0.2.0] - 2026-10-17

### Added
- SSE streaming support for `chat/completions` in the HostYourAI chat model.
- Streaming event parsing with text-delta emission and finish chunk handling.
- Expanded streaming and transport regression tests (malformed SSE, fallback finish, array deltas, openStream errors, routing behavior).

### Changed
- Minor release bump to introduce streaming support.
- Credentials now use a fixed HostYourAI API base URL (`https://hostyourai.com/api/v1`) to remove unnecessary configuration complexity.

### Fixed
- Automatic fallback for `hyai/auto` when `transport=body` is rejected with `422 extra_forbidden` on `body.hyai`.
- On fallback, request is retried with `X-HYAI-Task` and `X-HYAI-Policy` headers.
- Streaming requests now reuse warmup retry and `hyai` body-to-header fallback logic, matching non-stream request behavior.

## [0.1.0] - 2026-10-17

### Added
- Initial community node release for HostYourAI chat model integration in n8n.
- Credential + model node with dynamic model loading and `hyai/auto` default.
- Router controls for `hyai/auto` (Task, Policy, Transport).
- Warmup retry handling for 503 responses with bounded retry/wait controls.
- README setup and usage documentation.
