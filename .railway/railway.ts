import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-east4-eqdc4a" });
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "us-east4-eqdc4a",
    sizeMB: 5000,
  });

  // Shared monorepo: no rootDirectory on either app service — apps/api and
  // apps/web both depend on packages/shared + packages/db via workspace:*,
  // so the build needs the full repo checkout, not an isolated subdirectory.
  const api = service("api", {
    source: github("manduulya/pipntick-trade"),
    build: {
      buildCommand: "pnpm install --frozen-lockfile && pnpm --filter @pipntick/api build",
    },
    deploy: {
      startCommand: "pnpm --filter @pipntick/api start",
    },
    env: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
    },
  });

  const web = service("web", {
    source: github("manduulya/pipntick-trade"),
    build: {
      buildCommand: "pnpm install --frozen-lockfile && pnpm --filter @pipntick/web build",
    },
    deploy: {
      startCommand: "pnpm --filter @pipntick/web start",
    },
  });

  return project("pipntick", {
    resources: [Postgres, postgresVolume, api, web],
  });
});
