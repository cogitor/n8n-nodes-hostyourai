# Release checklist

Use this checklist before and during a tagged npm release.

## 1) Local quality gates (required)

- `npm test`
- `npm run lint`
- `npm run build`

All three must pass before tagging.

## 2) Repo state gates (required)

- `CHANGELOG.md` updated for the release version.
- `package.json` version matches the intended tag version.
- Working tree is clean before creating/pushing the tag.

## 3) CI gate (required)

- Main CI workflow is green for the release commit.

## 4) Publish gate (required)

- Tag-triggered Publish workflow completes successfully.

## 5) Registry verification gate (required)

- `npm view @cogitor/n8n-nodes-hostyourai version --json`
  returns the new version.

## 6) Provenance attestation gate (required)

- Publish workflow logs include both:
  - signed provenance statement message
  - transparency log URL (Sigstore)

## Quick command sequence

1. Update changelog + version
2. Run local gates (`test`, `lint`, `build`)
3. Commit and push `main`
4. Create/push tag (`x.y.z`)
5. Watch Publish run
6. Verify npm version and provenance log lines
