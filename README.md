# pipntick.trade

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + TypeScript + Tailwind CSS |
| Backend | Node.js + Fastify + TypeScript |
| Database | PostgreSQL + Redis |
| Auth | Clerk |
| Realtime | WebSockets + React Query |

## Monorepo Structure

```
pipntick.trade/
├── apps/
│   ├── web/                  # Next.js frontend (port 3000)
│   └── api/                  # Fastify backend (port 3001)
├── packages/
│   └── shared/               # Shared TypeScript types
├── design-system/
│   ├── colors.md             # Color palette
│   └── logo.md               # Logo guidelines
├── package.json              # Root workspace
├── pnpm-workspace.yaml
└── turbo.json
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Run individually
pnpm --filter @pipntick/web dev
pnpm --filter @pipntick/api dev
```
