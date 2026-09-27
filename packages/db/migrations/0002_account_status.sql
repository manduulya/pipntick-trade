CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "is_default" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
-- Data fix (hand-written) so the one-default-per-user index below can be created: is_default used
-- to default to true and was never maintained, so a user may have several defaults or none.
-- 1) Keep only each user's oldest default.
UPDATE "trading_accounts" SET "is_default" = false
WHERE "is_default" AND "id" NOT IN (
  SELECT DISTINCT ON ("user_id") "id" FROM "trading_accounts"
  WHERE "is_default"
  ORDER BY "user_id", "created_at", "id"
);--> statement-breakpoint
-- 2) Users with no default get their oldest account as the default.
UPDATE "trading_accounts" SET "is_default" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("user_id") "id" FROM "trading_accounts" a
  WHERE NOT EXISTS (SELECT 1 FROM "trading_accounts" d WHERE d."user_id" = a."user_id" AND d."is_default")
  ORDER BY "user_id", "created_at", "id"
);--> statement-breakpoint
CREATE UNIQUE INDEX "trading_accounts_one_default_per_user" ON "trading_accounts" USING btree ("user_id") WHERE "trading_accounts"."is_default";
