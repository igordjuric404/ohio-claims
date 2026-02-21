# Ohio Auto Claims Multi-Agent Pipeline

Monorepo for an end-to-end, six-stage sequential auto claims processing pipeline built with OpenClaw agents, deployed on AWS Free Tier with a Cloudflare Pages UI.

## Structure

- `infra/` — AWS infrastructure provisioning scripts (CLI-based)
- `openclaw/` — OpenClaw agent configs, system prompts, and plugin tools
- `services/claims-api/` — Backend API + orchestrator (Fastify / Node.js)
- `packages/shared/` — Shared TypeScript types, JSON schemas, validation
- `ui/` — Cloudflare Pages UI (Vite + React + TypeScript)
- `docs/` — Architecture docs, compliance pack, runbooks

## Quick Start

```bash
# Install dependencies
pnpm install

# Run claims API locally
pnpm --filter @ohio-claims/claims-api dev

# Run UI locally
cd ui && npx wrangler pages dev
```

## Pipeline Stages

1. **Front Desk** — FNOL registration, triage, completeness check
2. **Claims Officer** — Coverage verification, policy applicability
3. **Assessor** — Damage estimation, total loss determination
4. **Fraud Analyst** — Risk scoring, suspicious pattern detection
5. **Senior Reviewer** — Final decision, business trade-off analysis
6. **Finance** — Payment execution (simulated), receipt generation

## Compliance

Ohio-specific: OAC 3901-1-54 claims handling timelines, ORC 3965 cybersecurity, ORC 1349.19 breach notification.

## Tech Stack

- **Runtime**: Node.js 22+, TypeScript
- **Agent Framework**: OpenClaw (multi-agent, sandboxed, plugin tools)
- **LLM Provider**: OpenRouter (single API key, multiple models)
- **Storage**: AWS DynamoDB + S3
- **UI Hosting**: Cloudflare Pages + Pages Functions (BFF proxy)
- **Backend Hosting**: AWS EC2 (Free Tier t3.micro)
- **Observability**: CloudWatch Logs + OpenClaw OTLP diagnostics
