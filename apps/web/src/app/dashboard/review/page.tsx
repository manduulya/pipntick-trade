"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CandleInterval, Trade } from "@pipntick/shared";
import { CANDLE_INTERVALS } from "@pipntick/shared";
import { useCandles, useTrades } from "../../../lib/hooks";
import { useSelectedAccount } from "../../../lib/account-context";
import { ApiError } from "../../../lib/api";
import { formatDuration } from "../../../lib/trade-utils";
import { useTimeFormat } from "../../../lib/time-format-context";
import { formatDateTime } from "../../../lib/time-format";
import { buildTradeMarkers, chartTimeZone, tradeInstants } from "../../../lib/trade-review-utils";
import EmptyAccountsState from "../EmptyAccountsState";
import MistakePill from "../_components/MistakePill";
import TradeChart from "./_components/TradeChart";

// Trade Review: pick a trade, see it on a candlestick chart with its entry/exit marked. Replaces
// the old "AI Analysis — Coming Soon" page; AI feedback on the selected trade can live here later.

type Filter = "all" | "wins" | "losses" | "mistakes";

function ReviewPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: trades, isLoading, isError, error } = useTrades();
  const { accounts, selectedAccount } = useSelectedAccount();
  const { timeFormat } = useTimeFormat();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [interval, setChartInterval] = useState<CandleInterval | "auto">("auto");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (trades ?? []).filter((t) => {
      if (q && !t.symbol.toLowerCase().includes(q)) return false;
      const pnl = t.pnl !== null ? Number(t.pnl) : null;
      if (filter === "wins") return pnl !== null && pnl > 0;
      if (filter === "losses") return pnl !== null && pnl < 0;
      if (filter === "mistakes") return t.isMistake;
      return true;
    });
  }, [trades, search, filter]);

  // ?trade=<id>, defaulting to the newest trade (the API returns newest first).
  const requestedId = params.get("trade");
  const selected: Trade | null =
    (trades ?? []).find((t) => t.id === requestedId) ?? (trades && trades.length ? trades[0] : null);

  useEffect(() => setChartInterval("auto"), [selected?.id]);

  function select(id: string) {
    router.replace(`/dashboard/review?trade=${id}`, { scroll: false });
  }

  const instants = selected ? tradeInstants(selected, selectedAccount) : null;
  const candleParams =
    selected && instants && !Number.isNaN(instants.entry.getTime())
      ? { symbol: selected.symbol, entry: instants.entry.toISOString(), exit: instants.exit?.toISOString(), interval }
      : null;
  const candles = useCandles(candleParams);
  const markers = useMemo(
    () => (selected && instants && candles.data ? buildTradeMarkers(selected, instants, candles.data.candles) : []),
    // instants derive from selected + account; recompute when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candles.data, selected?.id, selectedAccount?.brokerTimezone, selectedAccount?.brokerUtcOffsetMinutes],
  );

  if (!isLoading && !isError && accounts.length === 0) return <EmptyAccountsState />;

  const allowed = candles.data?.allowedIntervals;
  const pnl = selected?.pnl != null ? Number(selected.pnl) : null;

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>Trade Review</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Pick a trade to see it on the chart, with your entry and exit marked.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
        {/* Trade list */}
        <aside
          className="lg:w-72 shrink-0 flex flex-col rounded-xl overflow-hidden max-h-64 lg:max-h-none"
          style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="p-2.5 flex flex-col gap-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol…"
              className="focus-ring w-full text-xs rounded-md px-2.5 py-1.5"
              style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", outline: "none" }}
            />
            <div className="flex gap-0.5 p-0.5 rounded-md" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
              {(["all", "wins", "losses", "mistakes"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className="flex-1 py-1 rounded text-[10px] font-semibold capitalize"
                  style={{
                    backgroundColor: filter === f ? "var(--color-border)" : "transparent",
                    color: filter === f ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="thin-scrollbar flex-1 overflow-y-auto">
            {isLoading && <p className="text-xs p-4 text-center" style={{ color: "var(--color-text-muted)" }}>Loading trades…</p>}
            {isError && (
              <p className="text-xs p-4 text-center" style={{ color: "var(--color-danger)" }}>
                {error instanceof ApiError ? error.message : "Couldn't load trades."}
              </p>
            )}
            {!isLoading && !isError && list.length === 0 && (
              <p className="text-xs p-4 text-center" style={{ color: "var(--color-text-muted)" }}>No trades match.</p>
            )}
            {list.map((t) => {
              const active = t.id === selected?.id;
              const p = t.pnl !== null ? Number(t.pnl) : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(t.id)}
                  aria-current={active ? "true" : undefined}
                  className="w-full text-left px-3 py-2.5 flex flex-col gap-0.5"
                  style={{
                    backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    boxShadow: active ? "inset 3px 0 0 var(--color-green-primary)" : undefined,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>{t.symbol}</span>
                    <span className="text-[10px]" style={{ color: t.direction === "long" ? "var(--color-green-neon)" : "var(--color-danger)" }}>
                      {t.direction === "long" ? "▲" : "▼"}
                    </span>
                    {t.isMistake && <MistakePill />}
                    <span
                      className="ml-auto text-xs font-semibold"
                      style={{ color: p === null ? "var(--color-text-muted)" : p >= 0 ? "var(--color-green-neon)" : "var(--color-danger)" }}
                    >
                      {p === null ? "open" : `${p >= 0 ? "+" : "-"}$${Math.abs(p).toFixed(2)}`}
                    </span>
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {formatDateTime(t.entryTime.slice(0, 16), timeFormat)}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chart + details */}
        <section
          className="flex-1 min-w-0 min-h-[420px] flex flex-col rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
        >
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>
              {isLoading ? "Loading…" : "No trades yet — log one in the Journal to review it here."}
            </div>
          ) : (
            <>
              <div className="shrink-0 flex items-center gap-3 flex-wrap px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{selected.symbol}</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    backgroundColor: selected.direction === "long" ? "rgba(123,193,59,0.15)" : "rgba(239,68,68,0.15)",
                    color: selected.direction === "long" ? "var(--color-green-neon)" : "var(--color-danger)",
                  }}
                >
                  {selected.direction === "long" ? "▲ Long" : "▼ Short"}
                </span>
                <span className="text-xs font-bold" style={{ color: pnl === null ? "var(--color-text-muted)" : pnl >= 0 ? "var(--color-green-neon)" : "var(--color-danger)" }}>
                  {pnl === null ? "open" : `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}
                </span>
                {candles.data && (
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {candles.data.ticker}{candles.data.approximate ? " (approx.)" : ""}
                  </span>
                )}
                <div className="ml-auto flex gap-0.5 p-0.5 rounded-md" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                  {(["auto", ...CANDLE_INTERVALS] as const).map((iv) => {
                    const disabled = iv !== "auto" && !!allowed && !allowed.includes(iv);
                    const on = interval === iv || (interval === "auto" && iv === "auto");
                    return (
                      <button
                        key={iv}
                        type="button"
                        disabled={disabled}
                        onClick={() => setChartInterval(iv)}
                        title={disabled ? "Not available this far back on free data" : undefined}
                        className="px-2 py-1 rounded text-[10px] font-semibold"
                        style={{
                          backgroundColor: on ? "var(--color-border)" : "transparent",
                          color: disabled ? "var(--color-text-disabled)" : on ? "var(--color-text-primary)" : "var(--color-text-muted)",
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                      >
                        {iv === "auto" && interval === "auto" && candles.data ? `Auto · ${candles.data.interval}` : iv === "auto" ? "Auto" : iv}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative flex-1 min-h-[300px]">
                {candles.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>Loading chart…</div>
                )}
                {candles.isError && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs px-6 text-center" style={{ color: "var(--color-danger)" }}>
                    {candles.error instanceof ApiError ? candles.error.message : "Couldn't load chart data."}
                  </div>
                )}
                {candles.data && candles.data.candles.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs px-6 text-center" style={{ color: "var(--color-text-muted)" }}>
                    No price data for this period (the market may have been closed).
                  </div>
                )}
                {candles.data && candles.data.candles.length > 0 && (
                  <TradeChart
                    candles={candles.data.candles}
                    markers={markers}
                    entryPrice={Number(selected.entryPrice)}
                    exitPrice={selected.exitPrice !== null ? Number(selected.exitPrice) : null}
                    timeZone={chartTimeZone(selectedAccount)}
                  />
                )}
              </div>

              <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 px-4 py-3 text-[11px]" style={{ borderTop: "1px solid var(--color-border)" }}>
                <div><span style={{ color: "var(--color-text-muted)" }}>Entry: </span><span style={{ color: "var(--color-text-secondary)" }}>{Number(selected.entryPrice)} · {formatDateTime(selected.entryTime.slice(0, 16), timeFormat)}</span></div>
                <div><span style={{ color: "var(--color-text-muted)" }}>Exit: </span><span style={{ color: "var(--color-text-secondary)" }}>{selected.exitPrice !== null ? `${Number(selected.exitPrice)} · ${selected.exitTime ? formatDateTime(selected.exitTime.slice(0, 16), timeFormat) : "—"}` : "open"}</span></div>
                <div><span style={{ color: "var(--color-text-muted)" }}>Duration: </span><span style={{ color: "var(--color-text-secondary)" }}>{formatDuration(selected.entryTime, selected.exitTime)}</span></div>
                <div><span style={{ color: "var(--color-text-muted)" }}>Session: </span><span style={{ color: "var(--color-text-secondary)" }}>{selected.session ?? "—"}</span></div>
                {selected.notes && (
                  <p className="col-span-2 sm:col-span-4" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="font-semibold" style={{ color: selected.isMistake ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                      {selected.isMistake ? "Mistake: " : "Notes: "}
                    </span>
                    {selected.notes}
                  </p>
                )}
              </div>
              <p className="shrink-0 px-4 pb-3 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                Free price data from Yahoo Finance
                {candles.data?.note ? ` · ${candles.data.note}` : ""} · can differ slightly from your broker&apos;s feed.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</div>}>
      <ReviewPageInner />
    </Suspense>
  );
}
