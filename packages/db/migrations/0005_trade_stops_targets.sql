ALTER TABLE "trades" ADD COLUMN "stop_loss" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "take_profits" jsonb DEFAULT '[]'::jsonb NOT NULL;