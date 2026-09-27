CREATE TYPE "public"."plan_status" AS ENUM('planned', 'logged', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."rule_type" AS ENUM('check', 'choice');--> statement-breakpoint
CREATE TYPE "public"."trade_grade" AS ENUM('F', 'D', 'C', 'B', 'A', 'A++');--> statement-breakpoint
CREATE TABLE "trade_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"plan_date" date NOT NULL,
	"symbol" text DEFAULT '' NOT NULL,
	"direction" "trade_direction" DEFAULT 'long' NOT NULL,
	"grade" "trade_grade",
	"status" "plan_status" DEFAULT 'planned' NOT NULL,
	"rules_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"journal_trade_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"type" "rule_type" DEFAULT 'check' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN IF NOT EXISTS "broker_utc_offset_minutes" integer;--> statement-breakpoint
ALTER TABLE "trade_plans" ADD CONSTRAINT "trade_plans_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_plans" ADD CONSTRAINT "trade_plans_journal_trade_id_trades_id_fk" FOREIGN KEY ("journal_trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_rules" ADD CONSTRAINT "trading_rules_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_plans_account_date_idx" ON "trade_plans" USING btree ("account_id","plan_date");--> statement-breakpoint
CREATE INDEX "trading_rules_account_idx" ON "trading_rules" USING btree ("account_id");