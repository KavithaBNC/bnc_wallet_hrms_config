# HRMS Release Process

## Overview

This project uses **semantic versioning** (`vMAJOR.MINOR.PATCH`) with automated GitHub Releases. Every push to `main` triggers a new release with an auto-incremented tag.

---

## Version Format

```
v1.2.3
│ │ │
│ │ └── PATCH  → bug fixes, small changes
│ └──── MINOR  → new features, backward-compatible
└────── MAJOR  → breaking changes
```

- First release starts at `v0.0.1`
- Default auto-increment on push to `main`: **patch** (`v0.0.1` → `v0.0.2` → `v0.0.3`)

---

## How It Works

### Automatic Release (on push to main)

```
Push to main
    ↓
Release workflow triggers
    ↓
Finds latest v* tag (or defaults to v0.0.0)
    ↓
Bumps patch version (v0.0.0 → v0.0.1)
    ↓
Generates changelog from commits since last tag
    ↓
Creates git tag + GitHub Release
```

### Manual Release (from GitHub UI)

1. Go to **Actions** → **Release with Tag**
2. Click **Run workflow**
3. Select version bump type:
   - `patch` — bug fixes (default)
   - `minor` — new features
   - `major` — breaking changes
4. Click **Run workflow**

---

## Workflow File

**Location:** `.github/workflows/release.yml`

**Triggers:**

| Trigger            | Bump Type | Example              |
|--------------------|-----------|----------------------|
| Push to `main`     | patch     | `v0.0.1` → `v0.0.2` |
| Manual — patch     | patch     | `v0.0.2` → `v0.0.3` |
| Manual — minor     | minor     | `v0.0.3` → `v0.1.0` |
| Manual — major     | major     | `v0.1.0` → `v1.0.0` |

**Required Permission:** `contents: write` (already configured in the workflow)

---

## Release Pipeline Flow

```
┌─────────────────────────────────────────────────────────┐
│                   Push to main                          │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   deploy.yml               │
        │   Build → Test → Deploy    │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   release.yml              │
        │   Tag → Changelog →        │
        │   GitHub Release           │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   GitHub Release Created   │
        │   e.g. v0.0.1              │
        └────────────────────────────┘
```

Both `deploy.yml` and `release.yml` trigger on push to `main` and run in parallel.

---

## Changelog Generation

The release automatically generates a changelog containing:

- All commit messages since the last tag
- Short commit hashes for reference
- Link to full diff between tags

**Example release notes:**

```
## What's Changed in v0.0.2

- Fix employee shift assignment validation (a1b2c3d)
- Add leave balance overflow check (d4e5f6g)
- Update Prisma schema for attendance punches (h7i8j9k)

**Full Changelog**: https://github.com/owner/repo/compare/v0.0.1...v0.0.2
```

---

## Common Scenarios

### First Release
Push any code to `main`. The workflow detects no existing tags and creates `v0.0.1`.

### Bug Fix Release
Push the fix to `main`. Auto-creates next patch version (e.g., `v0.0.5` → `v0.0.6`).

### Feature Release
1. Go to **Actions** → **Release with Tag** → **Run workflow**
2. Select **minor**
3. Creates e.g., `v0.1.0`

### Breaking Change Release
1. Go to **Actions** → **Release with Tag** → **Run workflow**
2. Select **major**
3. Creates e.g., `v1.0.0`

### View All Releases
- GitHub UI: **Releases** tab on the repository page
- CLI: `gh release list`

### View a Specific Release
```bash
gh release view v0.0.1
```

### Download a Release
```bash
gh release download v0.0.1
```

---

## Secrets Required

No additional secrets needed. The workflow uses the built-in `GITHUB_TOKEN` which has `contents: write` permission.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tag already exists | Delete the conflicting tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z` then re-run |
| No release created | Check Actions tab for errors. Ensure `permissions: contents: write` is set |
| Wrong version bumped | Use manual trigger with correct bump type to get back on track |
| Changelog is empty | Happens if no new commits since last tag. Release still creates with "No notable changes" |
