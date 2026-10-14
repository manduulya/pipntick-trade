CREATE TYPE "public"."asset_class" AS ENUM('futures', 'forex', 'stocks', 'crypto');--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "asset_class" "asset_class" DEFAULT 'forex' NOT NULL;--> statement-breakpoint
-- Hand-written data fix: set each existing account to the class most of its trades belong to,
-- mirroring inferAssetClass in @pipntick/shared (futures roots and crypto pairs listed inline as a
-- frozen snapshot). Accounts without trades keep the 'forex' default.
WITH classified AS (
  SELECT
    account_id,
    CASE
      WHEN upper(symbol) IN ('ES','MES','NQ','MNQ','YM','MYM','RTY','M2K','GC','MGC','SI','SIL','HG','MHG','PL',
                             'CL','MCL','NG','ZB','ZN','ZF','ZT','6E','M6E','6B','6J','6A','6C','BTC','MBT','ETH','MET',
                             'ZC','ZS','ZW') THEN 'futures'
      WHEN upper(symbol) IN ('BTC/USD','ETH/USD','XRP/USD','SOL/USD') THEN 'crypto'
      WHEN upper(symbol) ~ '^[A-Z]{3}/[A-Z]{3}$' OR upper(symbol) IN ('US30','NAS100','SPX500','GER40','UK100') THEN 'forex'
      ELSE 'stocks'
    END AS cls
  FROM "trades"
),
ranked AS (
  SELECT account_id, cls,
         row_number() OVER (PARTITION BY account_id ORDER BY count(*) DESC, cls) AS rn
  FROM classified
  GROUP BY account_id, cls
)
UPDATE "trading_accounts" a
SET "asset_class" = r.cls::"asset_class"
FROM ranked r
WHERE r.account_id = a.id AND r.rn = 1;
