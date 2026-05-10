# Publishing the Hyperclip SDKs

Two registries, two workflows. Both are free for public packages. Aim for the same version number across them so docs/changelog stay aligned.

> The main `hyperclip/hyperclip` repo is private. The SDKs are mirrored to a public repo `hyperclip/hyperclip-sdks` so the `repository` link on npmjs.com / pypi.org resolves and so users can read source / file issues. See [§0 Public mirror setup](#0-public-mirror-setup) for the one-time bootstrap.

---

## 0. Public mirror setup

This only needs to be done once.

### a. Create the public repo

```sh
# logged in as the hyperclip GitHub org
gh repo create hyperclip/hyperclip-sdks \
  --public \
  --description "Official Hyperclip SDKs (Node, Python). Source mirrored from a private monorepo." \
  --homepage "https://hyperclip.co"
```

Leave it empty — the first sync run will populate it.

### b. Generate a deploy key

A deploy key is an SSH keypair scoped to one repo. The private half goes in the monorepo's CI secrets, the public half goes on `hyperclip-sdks` with **write** access. This is tighter than a personal access token because it can only push to that one repo.

```sh
# generate a fresh keypair locally — don't reuse an existing one
ssh-keygen -t ed25519 -N "" -C "hyperclip-sdks-sync" -f /tmp/sdks-deploy-key
```

You now have `/tmp/sdks-deploy-key` (private) and `/tmp/sdks-deploy-key.pub` (public).

### c. Install the public half on hyperclip-sdks

```sh
gh repo deploy-key add /tmp/sdks-deploy-key.pub \
  --repo hyperclip/hyperclip-sdks \
  --title "monorepo sync" \
  --allow-write
```

(Or via web UI: `hyperclip-sdks` → Settings → Deploy keys → Add deploy key → paste the `.pub` contents → check "Allow write access".)

### d. Install the private half as a secret on the monorepo

```sh
gh secret set PUBLIC_SDKS_DEPLOY_KEY \
  --repo hyperclip/hyperclip \
  < /tmp/sdks-deploy-key
```

(Or web UI: `hyperclip/hyperclip` → Settings → Secrets and variables → Actions → New repository secret → name `PUBLIC_SDKS_DEPLOY_KEY` → value = full contents of the private key including the `BEGIN`/`END` lines.)

Then **delete the local key file** — it's only needed in the two GitHub-side stores:

```sh
rm /tmp/sdks-deploy-key /tmp/sdks-deploy-key.pub
```

### e. Run the first sync manually

```sh
# from the monorepo root, with your own SSH key trusted by hyperclip-sdks
# (you'll need write access to hyperclip-sdks for this one-shot bootstrap)
./scripts/sync-sdks.sh
```

Or trigger the workflow from GitHub: Actions → "Sync SDKs to public mirror" → Run workflow.

After this, `https://github.com/hyperclip/hyperclip-sdks` mirrors `sdks/` from the monorepo. Every push to `main` that touches `sdks/**` triggers a re-sync.

### How the sync works

[`scripts/sync-sdks.sh`](../scripts/sync-sdks.sh):

1. Shallow-clones `hyperclip-sdks` (or `git init`s it if empty).
2. Wipes the working tree, copies the current `sdks/` over.
3. If `git diff` shows no change, exits without committing — keeps history clean.
4. Otherwise commits as `hyperclip-bot` with message `sync sdks/ from monorepo @ <short-sha>` and pushes.

This is a **squashed mirror** — private commit messages and SHAs aren't exposed beyond the 7-char hash in the sync commit. If you ever want richer history on the public side, switch to `git subtree split`, but that leaks every private commit message. The squash approach is the safer default.

### Editing the SDKs

Always edit them inside this monorepo (under `sdks/`). Don't push directly to `hyperclip-sdks` — your changes will be overwritten on the next sync. PRs filed against `hyperclip-sdks` need to be replayed by hand into the monorepo.

If you want to accept community PRs on the public repo, the easiest pattern is:
- Reviewer reads the PR, accepts the patch in principle.
- Apply the diff inside the monorepo, commit, push.
- The auto-sync re-publishes it to the public repo.
- Close the original PR with a "merged via sync from monorepo @ <sha>" comment.

---

## 1. Names

| Registry | Account / org | Package name | Install command |
|---|---|---|---|
| npm | org `hyperclipco` | `hyperclip` (unscoped — free) | `npm install hyperclip` |
| PyPI | user `hyperclip` | `hyperclipco` (bare `hyperclip` was taken) | `pip install hyperclipco` |

The Python *module* name matches the install name — `from hyperclipco import Hyperclip`. The class stays `Hyperclip` either way (matches `from openai import OpenAI` convention).

Re-check availability before each first publish (someone may have squatted between when you read this and when you publish):

```sh
curl -sI https://registry.npmjs.org/hyperclip       | head -1   # 404 = free
curl -sI https://pypi.org/pypi/hyperclipco/json     | head -1   # 404 = free
```

If you ever want to reclaim `hyperclip` on PyPI, the existing project is a candidate for [PEP 541 transfer](https://peps.python.org/pep-0541/) if it's abandoned — email `admin@pypi.org` with usage evidence.

---

## 2. npm (Node SDK)

### One-time setup

1. Create an npm account: <https://www.npmjs.com/signup>. Verify the email — npm blocks publishes from unverified accounts.
2. Enable 2FA on the account (Settings → Two-Factor Authentication → "Authorization and writes"). npm requires 2FA for any new package by default.
3. (Recommended) Create an organization for the brand:
   - <https://www.npmjs.com/org/create> → name it `hyperclip`. Free for public packages.
   - This reserves the `@hyperclip` scope so nobody else can publish under it later, even if you stick with the unscoped `hyperclip` name for now.
4. Log in locally:
   ```sh
   npm login
   ```

### First publish

```sh
cd sdks/node
npm install
npm run build          # produces dist/
npm publish --access public --otp <6-digit code>
```

That's it — within ~30 seconds the package is live at `https://www.npmjs.com/package/hyperclip` and installable with `npm install hyperclip`.

### Subsequent releases

```sh
# bump version (rewrites package.json, creates a git tag)
npm version patch      # or minor / major
git push --follow-tags
npm publish --otp <6-digit code>
```

You **cannot republish the same version**. If you publish 0.1.0 and then notice a typo, you must publish 0.1.1. (You can `npm unpublish` within 72 hours, but don't make a habit of it — npm discourages it and breaks downstream installs.)

### Automating with GitHub Actions

Mint an automation token that bypasses 2FA for CI: npm → Access Tokens → "Generate New Token" → **Granular Access Token**, scope it to the `hyperclip` package, and add it as `NPM_TOKEN` in the GitHub repo secrets.

`.github/workflows/publish-node.yml`:

```yaml
name: Publish Node SDK
on:
  push:
    tags: ['node-v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # for npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - working-directory: sdks/node
        run: |
          npm install
          npm run build
          npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Tag a release with `git tag node-v0.1.1 && git push --tags` and CI does the rest. `--provenance` adds a verifiable link from the published tarball back to the GitHub commit — shows up as a green checkmark on npmjs.com.

---

## 3. PyPI (Python SDK)

### One-time setup

1. Create a PyPI account: <https://pypi.org/account/register/>. Verify the email.
2. Enable 2FA (Account → Add 2FA). PyPI **requires** 2FA for new project owners.
3. (Recommended) Create a TestPyPI account at <https://test.pypi.org/account/register/> — same email is fine — for dry-run publishes.
4. Install build tools locally:
   ```sh
   pip install --upgrade build twine
   ```

### First publish — dry run on TestPyPI

```sh
cd sdks/python
python -m build          # produces dist/hyperclip-0.1.0.tar.gz + .whl

# upload to test.pypi.org first
python -m twine upload --repository testpypi dist/*

# verify install works
pip install --index-url https://test.pypi.org/simple/ hyperclip
python -c "from hyperclip import Hyperclip; print('ok')"
```

Twine will prompt for username/password. **Use an API token instead of your password**: PyPI → Account Settings → Add API Token → scope "Entire account" for the first upload. When prompted:
- username: `__token__`
- password: paste the token (starts with `pypi-`)

Or set `~/.pypirc`:
```ini
[testpypi]
  username = __token__
  password = pypi-AgEN...

[pypi]
  username = __token__
  password = pypi-AgEI...
```

### First publish — real PyPI

Once TestPyPI is happy:

```sh
python -m twine upload dist/*
```

Live at `https://pypi.org/project/hyperclip/`, installable with `pip install hyperclipco`.

After the first upload, go back to PyPI and **scope the token** down: delete the account-wide token, mint a new one scoped to the `hyperclip` project only, and replace it everywhere.

### Subsequent releases

```sh
# bump version in pyproject.toml ([project].version) AND src/hyperclip/__init__.py
rm -rf dist
python -m build
python -m twine upload dist/*
```

Same rule as npm: each version is immutable. PyPI lets you "yank" a release (hides it from `pip install` but keeps it for existing pins) — useful for a botched upload.

### Automating with GitHub Actions — trusted publishing (recommended)

PyPI's "trusted publisher" flow skips the API token entirely: GitHub OIDC proves to PyPI that the workflow run is legitimate.

1. PyPI → your project → Publishing → Add → fill in:
   - Owner: `hyperclip` (your GitHub org)
   - Repo: `hyperclip`
   - Workflow: `publish-python.yml`
   - Environment: `pypi` (optional but recommended — adds a manual approval gate)

`.github/workflows/publish-python.yml`:

```yaml
name: Publish Python SDK
on:
  push:
    tags: ['py-v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      id-token: write   # required for trusted publishing
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - working-directory: sdks/python
        run: |
          pip install --upgrade build
          python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: sdks/python/dist
```

No `PYPI_API_TOKEN` secret needed.

---

## 4. Versioning + release coordination

Keep both SDKs on the same SemVer line whenever possible — `0.1.0` Node ↔ `0.1.0` Python — so a user reading the docs doesn't have to mentally translate.

A simple release script (`scripts/release-sdks.sh`) you can add later:

```sh
#!/usr/bin/env bash
set -euo pipefail
VERSION="$1"

# bump
(cd sdks/node && npm version "$VERSION" --no-git-tag-version)
sed -i '' "s/^version = .*/version = \"$VERSION\"/" sdks/python/pyproject.toml
sed -i '' "s/__version__ = .*/__version__ = \"$VERSION\"/" sdks/python/src/hyperclip/__init__.py

git add -A
git commit -m "sdks: release v$VERSION"
git tag "node-v$VERSION" "py-v$VERSION"
git push --follow-tags
```

The two CI workflows above fire off the matching tag and publish in parallel.

---

## 5. After the first publish

- Add npm + PyPI badges to each SDK's README.
- Link both from `/docs/api/quickstart.mdx` so the docs surface the SDKs alongside the curl examples.
- Watch the package pages for download counts and security advisories. Both registries email you on advisories that affect your dependencies.

---

## TL;DR checklist

- [ ] `npm login`, then `cd sdks/node && npm install && npm run build && npm publish --access public`
- [ ] `pip install build twine`, then `cd sdks/python && python -m build && twine upload dist/*`
- [ ] Mint scoped tokens (npm: granular access token; PyPI: project-scoped token or trusted publisher)
- [ ] Wire both publish workflows to git tags
- [ ] Add a release script that bumps both versions in lockstep
