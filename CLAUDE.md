# CLAUDE.md

Guidelines and context for AI assistants (Claude Code and others) working on this codebase.

## Project Overview

**fred2026** is a Cloudflare Worker that runs [OpenClaw](https://github.com/openclaw/openclaw) (formerly Moltbot/Clawdbot) in a Cloudflare Sandbox container. It acts as a lightweight edge proxy and orchestrator that:

- Starts and manages the OpenClaw gateway in a sandboxed container
- Proxies HTTP and WebSocket requests to the container
- Hosts an admin UI at `/_admin/` for device management
- Exposes API endpoints at `/api/*` for device pairing
- Optionally exposes debug endpoints at `/debug/*`
- Provides browser automation via CDP shim

**Note on naming:** The CLI tool and npm package are now named `openclaw`. Config files live at `.openclaw/openclaw.json`. Legacy `.clawdbot` paths are supported for backward compatibility.

---

## Architecture

```
Browser
   │
   ▼
┌─────────────────────────────────────┐
│     Cloudflare Worker (index.ts)    │
│  - Starts OpenClaw in sandbox       │
│  - Proxies HTTP/WebSocket requests  │
│  - Passes secrets as env vars       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│     Cloudflare Sandbox Container    │
│  ┌───────────────────────────────┐  │
│  │     OpenClaw Gateway          │  │
│  │  - Control UI on port 18789   │  │
│  │  - WebSocket RPC protocol     │  │
│  │  - Agent runtime              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry point: sandbox lifecycle, routing, WebSocket proxying |
| `Dockerfile` | Container image (cloudflare/sandbox + Node 22 + OpenClaw) |
| `start-openclaw.sh` | Startup script: R2 restore → onboard → config patch → launch gateway |
| `wrangler.jsonc` | Cloudflare Worker + Container + bindings configuration |

---

## Project Structure

```
src/
├── index.ts          # Main Hono app, middleware, route mounting
├── types.ts          # TypeScript type definitions (MoltbotEnv, etc.)
├── config.ts         # Constants (ports, timeouts, paths)
├── auth/             # Cloudflare Access authentication
│   ├── index.ts
│   ├── jwt.ts        # JWT verification using jose
│   ├── jwt.test.ts
│   ├── middleware.ts # Hono middleware for auth
│   └── middleware.test.ts
├── gateway/          # OpenClaw gateway management
│   ├── index.ts
│   ├── process.ts    # Process lifecycle (find, start, wait)
│   ├── process.test.ts
│   ├── env.ts        # Environment variable building for container
│   ├── env.test.ts
│   ├── r2.ts         # R2 bucket mounting via rclone
│   ├── r2.test.ts
│   ├── sync.ts       # R2 backup sync logic
│   ├── sync.test.ts
│   └── utils.ts      # waitForProcess() and other helpers
├── routes/           # HTTP route handlers
│   ├── index.ts
│   ├── api.ts        # /api/* (devices, gateway management)
│   ├── admin-ui.ts   # /_admin/* (static file serving)
│   ├── cdp.ts        # Chrome DevTools Protocol shim
│   ├── debug.ts      # /debug/* (process/log inspection)
│   └── public.ts     # Public routes (health, logos)
├── client/           # React admin UI (built with Vite)
│   ├── main.tsx
│   ├── App.tsx
│   ├── api.ts        # API client for admin panel
│   └── pages/
│       └── AdminPage.tsx
├── utils/
│   └── logging.ts    # Request logging with sensitive param redaction
└── test-utils.ts     # Shared test helpers

skills/               # OpenClaw skills/extensions
└── cloudflare-browser/
    ├── SKILL.md
    └── scripts/      # CDP client, screenshot, video automation

test/
└── e2e/              # End-to-end integration tests
```

---

## Commands

```bash
npm test              # Run tests once (vitest)
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run build         # Build worker + client
npm run deploy        # Build and deploy to Cloudflare
npm run dev           # Vite dev server (client only)
npm run start         # wrangler dev (full local worker)
npm run typecheck     # TypeScript type check (no emit)
npm run lint          # Lint with oxlint
npm run lint:fix      # Lint and auto-fix
npm run format        # Format with oxfmt
npm run format:check  # Check formatting without writing
```

Run `npm test` and `npm run typecheck` before committing changes.

---

## Development Workflow

### Local Setup

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars — at minimum set ANTHROPIC_API_KEY
npm run start         # wrangler dev for full local worker
```

For local `.dev.vars`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
DEV_MODE=true           # Skips CF Access auth + device pairing
DEBUG_ROUTES=true       # Enables /debug/* routes
```

**WebSocket limitation:** `wrangler dev` has issues proxying WebSocket connections through the sandbox. HTTP works; WebSocket may fail locally. Deploy to Cloudflare for full functionality.

### Docker Image Caching

When changing `start-openclaw.sh`, bump the cache-bust comment in `Dockerfile`:

```dockerfile
# Build cache bust: 2026-02-06-v28-openclaw-upgrade
```

---

## Testing

Tests use **Vitest** in Node environment. Test files are colocated with source (`*.test.ts`).

```
src/auth/jwt.test.ts          # JWT decoding and validation
src/auth/middleware.test.ts   # Auth middleware behavior
src/gateway/env.test.ts       # Environment variable building
src/gateway/process.test.ts   # Process finding logic
src/gateway/r2.test.ts        # R2 mounting logic
src/gateway/sync.test.ts      # R2 backup sync logic
```

When adding new functionality, add corresponding tests.

E2E tests live in `test/e2e/` with Terraform fixtures for test infrastructure.

---

## Code Style

- **TypeScript strict mode** — no implicit `any`, exact types
- Prefer **explicit types** over inference for function signatures
- Keep **route handlers thin** — extract business logic to separate modules under `src/gateway/` or `src/utils/`
- Use **Hono context methods** for responses: `c.json()`, `c.html()`, `c.text()`
- **Formatter:** oxfmt — 2-space indent, single quotes, semicolons, trailing commas, 100-char line width
- **Linter:** oxlint — correctness errors, suspicious/perf warnings; react, typescript, unicorn, import plugins

---

## Key Patterns and Gotchas

### Environment Variables

Worker-level env vars are defined in the `MoltbotEnv` interface (`src/types.ts`).

| Worker Secret | Maps To (Container) | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | Direct Anthropic |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | Direct OpenAI |
| `CLOUDFLARE_AI_GATEWAY_API_KEY` | same | Native CF AI Gateway key |
| `CF_AI_GATEWAY_ACCOUNT_ID` | same | CF AI Gateway account |
| `CF_AI_GATEWAY_GATEWAY_ID` | same | CF AI Gateway gateway ID |
| `MOLTBOT_GATEWAY_TOKEN` | `OPENCLAW_GATEWAY_TOKEN` | Required for remote access |
| `DEV_MODE` | `OPENCLAW_DEV_MODE` | Skip auth and pairing |
| `TELEGRAM_BOT_TOKEN` | same | Optional |
| `DISCORD_BOT_TOKEN` | same | Optional |
| `SLACK_BOT_TOKEN` | same | Optional |
| `SLACK_APP_TOKEN` | same | Optional |
| `CDP_SECRET` | same | Browser automation auth |
| `WORKER_URL` | same | Public URL for CDP |
| `R2_ACCESS_KEY_ID` | same | R2 storage |
| `R2_SECRET_ACCESS_KEY` | same | R2 storage |
| `CF_ACCOUNT_ID` | same | R2 endpoint |

- **`DEV_MODE=true`** — Skips CF Access JWT auth AND device pairing
- **`DEBUG_ROUTES=true`** — Enables `/debug/*` endpoints (disabled by default in production)

When adding a new env var:
1. Add to `MoltbotEnv` in `src/types.ts`
2. If forwarded to container, add to `buildEnvVars()` in `src/gateway/env.ts`
3. Update `.dev.vars.example`
4. Document in `README.md` secrets table

### CLI Commands Inside Container

When calling the OpenClaw CLI from the Worker, always include `--url ws://localhost:18789`:

```typescript
sandbox.startProcess('openclaw devices list --json --url ws://localhost:18789')
```

CLI commands take **10–15 seconds** due to WebSocket connection overhead. Use the `waitForProcess()` helper in `src/gateway/utils.ts`.

### Success Detection

The CLI outputs "Approved" (capital A). Use case-insensitive checks to be safe:

```typescript
stdout.toLowerCase().includes('approved')
```

### AI Provider Priority

The startup script (`start-openclaw.sh`) selects the auth choice based on which env vars are set:

1. **Cloudflare AI Gateway** (native): `CLOUDFLARE_AI_GATEWAY_API_KEY` + `CF_AI_GATEWAY_ACCOUNT_ID` + `CF_AI_GATEWAY_GATEWAY_ID`
2. **Direct Anthropic**: `ANTHROPIC_API_KEY` (optionally with `ANTHROPIC_BASE_URL`)
3. **Direct OpenAI**: `OPENAI_API_KEY`
4. **Legacy AI Gateway**: `AI_GATEWAY_API_KEY` + `AI_GATEWAY_BASE_URL`

### OpenClaw Config Schema

OpenClaw has strict config validation. Common gotchas:

- `agents.defaults.model` must be `{ "primary": "model/name" }`, not a string
- `gateway.mode` must be `"local"` for headless operation
- No `webchat` channel — the Control UI is served automatically
- `gateway.bind` is not a config option — use the `--bind` CLI flag

See [OpenClaw docs](https://docs.openclaw.ai/) for the full config schema.

### R2 Storage

R2 is mounted via s3fs at `/data/moltbot`. Critical gotchas:

- **rsync flags:** Use `rsync -r --no-times` (not `rsync -a`). s3fs doesn't support setting timestamps and rsync will fail with "Input/output error".
- **Mount checking:** Don't rely on `sandbox.mountBucket()` error messages to detect "already mounted". Check `mount | grep s3fs` instead.
- **Never delete R2 data:** `/data/moltbot` IS the R2 bucket. Running `rm -rf /data/moltbot/*` deletes your backup. Always check mount status before destructive operations.
- **Process status lag:** `proc.status` may not update immediately after completion. Verify success by checking for expected output, not `proc.status === 'completed'`.
- **R2 prefix:** Backups are stored under `openclaw/` prefix (was `clawdbot/`). The startup script handles restoring from both old and new prefixes with automatic migration.

---

## Adding Common Things

### New API Endpoint

1. Add route handler in `src/routes/api.ts`
2. Add types to `src/types.ts` if needed
3. Update client API in `src/client/api.ts` if the frontend needs it
4. Add tests

### New Environment Variable

1. Add to `MoltbotEnv` interface in `src/types.ts`
2. If forwarded to container, add to `buildEnvVars()` in `src/gateway/env.ts`
3. Update `.dev.vars.example`
4. Document in `README.md` secrets table

---

## Debugging

```bash
# View live Worker logs
npx wrangler tail

# List configured secrets
npx wrangler secret list
```

Enable debug routes with `DEBUG_ROUTES=true` and inspect `/debug/processes` for container process info.

---

## Documentation Files

| File | Audience | Purpose |
|------|----------|---------|
| `README.md` | End users | Setup, configuration, usage, troubleshooting |
| `AGENTS.md` | AI agents | Project structure, key patterns, common tasks |
| `CLAUDE.md` | AI assistants | This file — conventions, workflows, gotchas |
| `CONTRIBUTING.md` | Contributors | Contribution policy including AI disclosure requirements |

Development documentation belongs in `AGENTS.md` / `CLAUDE.md`, not `README.md`.

> **AI Contribution Policy:** Per `CONTRIBUTING.md`, AI-generated contributions must be disclosed and verified by a human maintainer. Do not submit AI-generated PRs without human review and explicit disclosure.
