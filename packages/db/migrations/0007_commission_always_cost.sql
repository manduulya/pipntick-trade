-- Commission is always a cost (commissionAsCost in @pipntick/shared). Trades saved before that rule
-- with a positive commission had it *added* to their auto-calculated P&L, so those P&Ls are high by
-- 2 x commission. Flip the commission negative and, where the P&L was auto-calculated (not a manual
-- override), take the 2 x commission back out. Manual P&L overrides are the trader's own number and
-- are left alone.
UPDATE "trades"
SET "pnl" = CASE
      WHEN NOT "pnl_manual" AND "pnl" IS NOT NULL THEN "pnl" - 2 * "commission"
      ELSE "pnl"
    END,
    "commission" = -"commission",
    "updated_at" = now()
WHERE "commission" > 0;
