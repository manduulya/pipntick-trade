"use client";

import { useEffect, useState } from "react";
import type { CreateTradeInput, ParsedTradeScreenshot, Trade } from "@pipntick/shared";
import { ASSET_CLASSES, MAX_TAKE_PROFITS, commissionAsCost, getContractSize, getFuturesContract, plannedRewardRisk } from "@pipntick/shared";
import { useCreateTrade, useUpdateTrade } from "../../../lib/hooks";
import { useSelectedAccount } from "../../../lib/account-context";
import { ApiError } from "../../../lib/api";
import { accountWallClockToUtc, accountZoneLabel, utcToAccountWallClock } from "../../../lib/time-format";
import { detectSession, toDatetimeLocal } from "../../../lib/trade-utils";
import InstrumentInput from "../InstrumentInput";
import { ensureInstruments, findInstrument } from "../../../lib/instruments";
import DateTimePicker from "./DateTimePicker";
import ScreenshotLinksModal from "./ScreenshotLinksModal";
import FormPopup from "./FormPopup";

// The one trade entry form, shared by Dashboard's Add Trade panel, Journal's Add/Edit modal, the
// calendar day edit and Trade Plan's Log to Journal. (The screenshot-OCR entry tab was removed
// from the UI; the API's /api/screenshot route and this form's `prefill` prop remain.)

export const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)",
  borderRadius: 6,
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  width: "100%",
};

// numeric(18,8) columns (entryPrice/exitPrice/lotSize) round-trip from Postgres padded to 8
// decimals (e.g. "4347.33000000"). Strip the padding for display without truncating any real
// precision someone actually entered.
function trimTrailingZeros(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isNaN(n) ? value : n.toString();
}

export function TradeForm({
  trade,
  prefill,
  onSaved,
  onDone,
  onCreated,
}: {
  /** Present -> edit an existing trade. Absent -> create a new one. */
  trade?: Trade;
  /** OCR-parsed screenshot data to prefill a fresh create with. Ignored in edit mode. */
  prefill?: ParsedTradeScreenshot | null;
  onSaved: (message: string) => void;
  /** Closes the surrounding modal on success. Omit for a persistent inline panel (e.g. Dashboard's
   * quick-add card) — the form resets itself in place instead so it's ready for the next entry. */
  onDone?: () => void;
  /** Create mode only: receives the newly created trade (e.g. so Trade Plan can link to it). */
  onCreated?: (trade: Trade) => void;
}) {
  const isEdit = !!trade;
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const mutation = isEdit ? updateTrade : createTrade;
  const { selectedAccount, readOnly } = useSelectedAccount();
  // Trade times are entered, displayed, stored and day-bucketed in the account's broker-server
  // timezone (what the user sees on their platform / screenshots) — the raw wall-clock digits,
  // never converted, same as lib/trade-utils.ts documents. The account's timezone (IANA zone,
  // daylight-saving aware; legacy accounts fall back to a fixed offset) is only used to map back
  // to a real instant for the three things that actually reason in real time: the "not in the
  // future" and account-start checks, and the London/NY/Tokyo session lookup. Unset = plain UTC.
  // Bounds for entry/exit: can't predate the account's own start date, can't be in the future.
  // Both the input's native min/max (best-effort, browser-dependent) and an explicit submit-time
  // check below, since not every browser enforces datetime-local min/max in its picker UI. Both
  // bounds are real instants converted into broker wall-clock to match the field's own scale.
  const toBrokerWallClock = (instant: Date) => utcToAccountWallClock(instant, selectedAccount);
  const minDateTime = selectedAccount ? toBrokerWallClock(new Date(selectedAccount.createdAt)) || undefined : undefined;
  // Slow tick so the "now" upper bound doesn't go stale while the form sits open — a form opened
  // at 23:58 would otherwise keep greying out "tomorrow" for the rest of the session even after
  // midnight passes. The submit-time check below reads a fresh `new Date()` regardless.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  const maxDateTime = toBrokerWallClock(now);

  const [direction, setDirection] = useState<"long" | "short">(trade?.direction ?? prefill?.direction ?? "long");
  const [hoverDirection, setHoverDirection] = useState<"long" | "short" | null>(null);
  const [symbol, setSymbol] = useState(trade?.symbol ?? prefill?.symbol ?? "");
  const [entryPrice, setEntryPrice] = useState(
    trade ? trimTrailingZeros(trade.entryPrice) : prefill?.entryPrice != null ? String(prefill.entryPrice) : ""
  );
  const [exitPrice, setExitPrice] = useState(
    trade ? trimTrailingZeros(trade.exitPrice) : prefill?.exitPrice != null ? String(prefill.exitPrice) : ""
  );
  // Both the stored trade time and the screenshot OCR value are already broker wall-clock digits,
  // so they drop straight into the (broker-time) fields with no conversion.
  const [entryDateTime, setEntryDateTime] = useState(toDatetimeLocal(trade?.entryTime ?? prefill?.entryDateTime));
  const [exitDateTime, setExitDateTime] = useState(toDatetimeLocal(trade?.exitTime ?? prefill?.exitDateTime));
  const [lotSize, setLotSize] = useState(
    trade ? trimTrailingZeros(trade.lotSize) : prefill?.lotSize != null ? String(prefill.lotSize) : ""
  );
  const [swap, setSwap] = useState(trade?.swap ?? (prefill?.swap != null ? String(prefill.swap) : ""));
  const [commission, setCommission] = useState(trade?.commission ?? (prefill?.commission != null ? String(prefill.commission) : ""));
  const [notes, setNotes] = useState(trade?.notes ?? "");
  // "Mistake?" — when ticked, Notes becomes the (required) description of the mistake.
  const [isMistake, setIsMistake] = useState(trade?.isMistake ?? false);
  // Optional planned levels — a stop and up to 5 targets, independent of each other. The target
  // list always shows at least one (possibly empty) input; empty inputs are ignored on save.
  const [stopLoss, setStopLoss] = useState(trade?.stopLoss != null ? trimTrailingZeros(trade.stopLoss) : "");
  const [takeProfits, setTakeProfits] = useState<string[]>(
    trade?.takeProfits?.length ? trade.takeProfits.map(trimTrailingZeros) : [""],
  );
  // Optional TradingView snapshot links, edited in ScreenshotLinksModal ("" = none).
  const [preTradeUrl, setPreTradeUrl] = useState(trade?.preTradeUrl ?? "");
  const [postTradeUrl, setPostTradeUrl] = useState(trade?.postTradeUrl ?? "");
  const [showScreenshots, setShowScreenshots] = useState(false);
  // Stop loss, targets and fees live in a popup (FormPopup) to keep the form short; its button
  // shows a summary of whatever is set.
  const [showExtras, setShowExtras] = useState(false);
  const [pnlOverride, setPnlOverride] = useState(trade?.pnlManual ?? false);
  const [manualPnl, setManualPnl] = useState(trade?.pnl ?? "");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [unlistedSymbol, setUnlistedSymbol] = useState(false);

  // The exact string values the edit form opened with, so submit can send only the optional
  // fields the user actually changed. Sending every optional every time re-asserts the whole
  // trade — which e.g. reopens a closed trade if the exit-price field happens to render empty.
  const initial = {
    exitPrice: trade ? trimTrailingZeros(trade.exitPrice) : "",
    exitDateTime: toDatetimeLocal(trade?.exitTime),
    swap: trade?.swap ?? "",
    commission: trade?.commission ?? "",
    notes: trade?.notes ?? "",
    isMistake: trade?.isMistake ?? false,
    stopLoss: trade?.stopLoss != null ? trimTrailingZeros(trade.stopLoss) : "",
    takeProfits: (trade?.takeProfits ?? []).map(trimTrailingZeros).join(","),
    preTradeUrl: trade?.preTradeUrl ?? "",
    postTradeUrl: trade?.postTradeUrl ?? "",
    pnlOverride: trade?.pnlManual ?? false,
    manualPnl: trade?.pnl ?? "",
  };
  const [dateError, setDateError] = useState<{ field: string; message: string } | null>(null);
  // Session boundaries (London/NY/Tokyo) are defined in UTC hours, so match against the UTC time,
  // not the raw broker wall-clock the field holds. Guard the ISO call against a not-yet-complete
  // field value so a half-typed date can't throw on render.
  const entryInstant = entryDateTime ? accountWallClockToUtc(entryDateTime, selectedAccount) : null;
  // Field labels carry the offset in force on the date being entered ("New York, UTC−4" in
  // September, UTC−5 in December), so they always match what's checked.
  const entryTzLabel = accountZoneLabel(selectedAccount, entryDateTime || undefined);
  const exitTzLabel = accountZoneLabel(selectedAccount, exitDateTime || entryDateTime || undefined);
  const session =
    entryInstant && !Number.isNaN(entryInstant.getTime())
      ? detectSession(entryInstant.toISOString().slice(11, 16))
      : "";

  // Clears a field's "missing" flag as soon as the user fixes it, rather than only on the next
  // submit attempt.
  function clearMissing(field: string) {
    setMissingFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : prev));
  }

  // Rejects an entry/exit date outside [account creation date, now]. `value` is a broker wall-clock
  // time, so shift it to the real instant (minus the account's UTC offset) before comparing to the
  // account start / now. Returns an error message, or null if in range (or absent).
  function validateDate(value: string): string | null {
    if (!value) return null;
    const instant = accountWallClockToUtc(value, selectedAccount);
    if (selectedAccount && instant < new Date(selectedAccount.createdAt)) {
      return "Can't be before the account's start date";
    }
    if (instant > new Date()) {
      return "Can't be in the future";
    }
    return null;
  }

  const missingInputStyle = { ...inputStyle, border: "1px solid var(--color-danger)" };

  // The account's asset class decides which instruments are offered, the size unit (contracts /
  // lots / shares / coins) and P&L sizing. Futures also show what a point is worth (see
  // FUTURES_CONTRACTS in @pipntick/shared).
  const assetClass = selectedAccount?.assetClass ?? "forex";
  const sizeSpec = ASSET_CLASSES[assetClass];
  const futures = assetClass === "futures" ? getFuturesContract(symbol) : null;

  // Stop / targets: soft side-of-entry hints (never blocking — breakeven/trailing stops and odd
  // targets are the trader's call) and the planned R:R once entry, stop and a target are set.
  const filledTargets = takeProfits.map((v) => v.trim()).filter((v) => v !== "" && Number(v) > 0).map(Number);
  const entryNum = entryPrice !== "" ? Number(entryPrice) : null;
  const stopNum = stopLoss !== "" ? Number(stopLoss) : null;
  const isLong = direction === "long";
  const stopWrongSide = entryNum !== null && stopNum !== null && (isLong ? stopNum > entryNum : stopNum < entryNum);
  const targetWrongSide = entryNum !== null && filledTargets.some((t) => (isLong ? t < entryNum : t > entryNum));
  const nearestTarget =
    entryNum !== null && filledTargets.length
      ? [...filledTargets].sort((a, b) => Math.abs(a - entryNum) - Math.abs(b - entryNum))[0]
      : null;
  const plannedRR = entryNum !== null ? plannedRewardRisk(entryNum, stopNum, nearestTarget) : null;

  // One-line summary of the collapsed "Stop loss, targets & fees" section, so nothing set there is
  // hidden by surprise.
  const feesTotal =
    swap !== "" || commission !== ""
      ? (swap !== "" ? Number(swap) : 0) + (commission !== "" ? commissionAsCost(Number(commission)) : 0)
      : null;
  const extrasSummary = [
    stopLoss !== "" ? `SL ${stopLoss}` : null,
    filledTargets.length ? `TP ${filledTargets.join(" / ")}` : null,
    feesTotal !== null ? `Fees ${feesTotal < 0 ? "−" : "+"}$${Math.abs(feesTotal).toFixed(2)}` : null,
  ].filter(Boolean).join(" · ");
  const screenshotCount = (preTradeUrl ? 1 : 0) + (postTradeUrl ? 1 : 0);

  const computedPnl =
    entryPrice !== "" && exitPrice !== "" && lotSize !== ""
      ? (direction === "long" ? Number(exitPrice) - Number(entryPrice) : Number(entryPrice) - Number(exitPrice)) *
          Number(lotSize) *
          getContractSize(symbol, assetClass) +
        (swap !== "" ? Number(swap) : 0) +
        // Commission is always a cost, typed with or without a minus (same rule as the API).
        (commission !== "" ? commissionAsCost(Number(commission)) : 0)
      : null;

  function resetFields() {
    setSymbol(""); setEntryPrice(""); setExitPrice("");
    setEntryDateTime(""); setExitDateTime(""); setLotSize("");
    setSwap(""); setCommission(""); setNotes(""); setIsMistake(false); setStopLoss(""); setTakeProfits([""]);
    setPreTradeUrl(""); setPostTradeUrl(""); setShowExtras(false);
    setPnlOverride(false); setManualPnl(""); setMissingFields([]); setDateError(null); setUnlistedSymbol(false);
  }

  function handleSuccess(message: string) {
    onSaved(message);
    if (onDone) onDone();
    else resetFields();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const missing: string[] = [];
    if (!symbol) missing.push("Instrument");
    if (!entryPrice) missing.push("Entry Price");
    if (!exitPrice) missing.push("Exit Price");
    if (!lotSize) missing.push("Lot Size");
    if (!entryDateTime) missing.push("Entry Date & Time");
    if (isMistake && !notes.trim()) missing.push("Mistake description");
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    // Only listed instruments of the account's class can be traded — free text would silently get
    // the wrong contract size. Wait for a stocks account's lazily-fetched list so a valid ticker
    // isn't rejected mid-load. Editing a legacy trade whose symbol predates the class keeps it.
    await ensureInstruments(assetClass);
    const keepLegacy = isEdit && symbol === trade.symbol;
    const instrument = keepLegacy ? { symbol, name: symbol } : findInstrument(symbol, assetClass);
    if (!instrument) {
      setUnlistedSymbol(true);
      return;
    }
    if (instrument.symbol !== symbol) setSymbol(instrument.symbol);

    const entryDateIssue = validateDate(entryDateTime);
    if (entryDateIssue) {
      setDateError({ field: "Entry Date & Time", message: entryDateIssue });
      return;
    }
    const exitDateIssue = validateDate(exitDateTime);
    if (exitDateIssue) {
      setDateError({ field: "Exit Date & Time", message: exitDateIssue });
      return;
    }
    if (exitDateTime && entryDateTime && new Date(`${exitDateTime}:00Z`) < new Date(`${entryDateTime}:00Z`)) {
      setDateError({ field: "Exit Date & Time", message: "Can't be earlier than the entry date & time" });
      return;
    }
    setDateError(null);

    const exitTimeIso = exitDateTime ? new Date(`${exitDateTime}:00Z`).toISOString() : null;
    const overridePnl = pnlOverride && manualPnl !== "" ? Number(manualPnl) : null;

    const input: CreateTradeInput = {
      symbol: instrument.symbol,
      direction,
      entryPrice: Number(entryPrice),
      lotSize: Number(lotSize),
      entryTime: new Date(`${entryDateTime}:00Z`).toISOString(),
      session: session || undefined,
    };

    if (isEdit) {
      // Send an optional field only if the user actually changed it: a value they set, or `null`
      // when they cleared one that had a value. Untouched fields are omitted so the server keeps
      // them exactly as stored (a blanket "send everything" could e.g. reopen a closed trade
      // whose exit-price field renders empty).
      if (exitPrice !== initial.exitPrice) input.exitPrice = exitPrice !== "" ? Number(exitPrice) : null;
      if (exitDateTime !== initial.exitDateTime) input.exitTime = exitTimeIso;
      if (swap !== initial.swap) input.swap = swap !== "" ? Number(swap) : null;
      if (commission !== initial.commission) input.commission = commission !== "" ? Number(commission) : null;
      if (notes !== initial.notes) input.notes = notes !== "" ? notes : null;
      if (isMistake !== initial.isMistake) input.isMistake = isMistake;
      if (stopLoss !== initial.stopLoss) input.stopLoss = stopLoss !== "" ? Number(stopLoss) : null;
      if (filledTargets.map(String).join(",") !== initial.takeProfits) input.takeProfits = filledTargets;
      if (preTradeUrl !== initial.preTradeUrl) input.preTradeUrl = preTradeUrl || null;
      if (postTradeUrl !== initial.postTradeUrl) input.postTradeUrl = postTradeUrl || null;
      if (pnlOverride !== initial.pnlOverride || manualPnl !== initial.manualPnl) input.pnl = overridePnl;
      updateTrade.mutate({ id: trade.id, input }, {
        onSuccess: () => handleSuccess("Trade updated successfully"),
      });
    } else {
      if (exitPrice) input.exitPrice = Number(exitPrice);
      if (exitTimeIso) input.exitTime = exitTimeIso;
      if (swap) input.swap = Number(swap);
      if (commission) input.commission = Number(commission);
      if (notes) input.notes = notes;
      if (isMistake) input.isMistake = true;
      if (stopLoss !== "") input.stopLoss = Number(stopLoss);
      if (filledTargets.length) input.takeProfits = filledTargets;
      if (preTradeUrl) input.preTradeUrl = preTradeUrl;
      if (postTradeUrl) input.postTradeUrl = postTradeUrl;
      if (overridePnl !== null) input.pnl = overridePnl;
      createTrade.mutate(input, {
        onSuccess: (created) => {
          onCreated?.(created);
          handleSuccess("Trade added successfully");
        },
      });
    }
  }

  // Archived account: every add/edit path funnels through this form, so it stands in for all of them.
  if (readOnly) {
    return (
      <p className="text-xs text-center py-6 px-4 rounded-lg" style={{ color: "var(--color-text-secondary)", border: "1px dashed var(--color-border)" }}>
        This account is archived, so trades can&rsquo;t be added or edited. Reactivate it to make changes.
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <InstrumentInput
        value={symbol}
        assetClass={assetClass}
        onChange={(v) => { setSymbol(v); clearMissing("Instrument"); setUnlistedSymbol(false); }}
        style={missingFields.includes("Instrument") || unlistedSymbol ? missingInputStyle : inputStyle}
      />
      {unlistedSymbol && (
        <p className="text-[10px] -mt-2" style={{ color: "var(--color-danger)" }}>
          &ldquo;{symbol}&rdquo; isn&rsquo;t a listed {sizeSpec.label.toLowerCase()} instrument — pick one from the suggestions.
        </p>
      )}
      {futures && (
        <p className="text-[10px] -mt-2" style={{ color: "var(--color-text-muted)" }}>
          {futures.name} futures · <span style={{ color: "var(--color-green-primary)" }}>${futures.pointValue.toLocaleString("en-US")} per point</span> per contract
        </p>
      )}
      <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
        {(["long", "short"] as const).map((d) => {
          const active = direction === d;
          const hovered = hoverDirection === d;
          // Theme-aware action colors: neon in dark mode, deeper AA-contrast text in light mode.
          const fg = d === "long" ? "var(--color-action-edit)" : "var(--color-action-delete)";
          const rgb = d === "long" ? "123,193,59" : "224,82,82";
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              onMouseEnter={() => setHoverDirection(d)}
              onMouseLeave={() => setHoverDirection(null)}
              aria-pressed={active}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all"
              style={{
                cursor: "pointer",
                // Selected: solid tint, a touch stronger on hover. Unselected: faint tint of its
                // own color on hover, so it previews what clicking will pick.
                backgroundColor: active ? `rgba(${rgb},${hovered ? 0.28 : 0.2})` : hovered ? `rgba(${rgb},0.08)` : "transparent",
                color: active || hovered ? fg : "var(--color-text-muted)",
                border: `1px solid ${active ? `rgba(${rgb},0.45)` : hovered ? `rgba(${rgb},0.25)` : "transparent"}`,
              }}
            >
              {d === "long" ? "▲ Long" : "▼ Short"}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Entry Price</label><input type="number" step="any" placeholder="0.00" value={entryPrice} onChange={(e) => { setEntryPrice(e.target.value); clearMissing("Entry Price"); }} style={missingFields.includes("Entry Price") ? missingInputStyle : inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Exit Price</label><input type="number" step="any" placeholder="0.00" value={exitPrice} onChange={(e) => { setExitPrice(e.target.value); clearMissing("Exit Price"); }} style={missingFields.includes("Exit Price") ? missingInputStyle : inputStyle} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Entry Date & Time ({entryTzLabel})</label><DateTimePicker tzLabel={entryTzLabel} min={minDateTime} max={maxDateTime} value={entryDateTime} onChange={(v) => { setEntryDateTime(v); clearMissing("Entry Date & Time"); setDateError(null); }} style={missingFields.includes("Entry Date & Time") || dateError?.field === "Entry Date & Time" ? missingInputStyle : inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Exit Date & Time ({exitTzLabel})</label><DateTimePicker tzLabel={exitTzLabel} min={entryDateTime || minDateTime} max={maxDateTime} value={exitDateTime} onChange={(v) => { setExitDateTime(v); setDateError(null); }} style={dateError?.field === "Exit Date & Time" ? missingInputStyle : inputStyle} /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Session</span>
        <span className="text-[11px] font-semibold" style={{ color: session ? "var(--color-green-primary)" : "var(--color-text-disabled)" }}>{session || "— enter entry time"}</span>
      </div>
      <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{sizeSpec.sizeLabel}</label><input type="number" step={sizeSpec.step} min={sizeSpec.min} placeholder={sizeSpec.placeholder} value={lotSize} onChange={(e) => { setLotSize(e.target.value); clearMissing("Lot Size"); }} style={missingFields.includes("Lot Size") ? missingInputStyle : inputStyle} /></div>
      {/* Optional extras, each in its own popup, side by side so the form stays short. The
          buttons summarize what's set, so nothing entered in a popup is hidden by surprise. */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setShowExtras(true)} className="form-extra-btn" title="Stop loss, take-profit targets, swap and commission">
          <span className="form-extra-btn__label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
            SL, targets &amp; fees
          </span>
          <span className="form-extra-btn__hint" data-set={extrasSummary ? "" : undefined}>{extrasSummary || "Optional"}</span>
        </button>
        <button type="button" onClick={() => setShowScreenshots(true)} className="form-extra-btn" title="Pre-trade and post-trade TradingView snapshot links">
          <span className="form-extra-btn__label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Screenshots
          </span>
          <span className="form-extra-btn__hint" data-set={screenshotCount ? "" : undefined}>
            {screenshotCount === 2 ? "Pre & post-trade ✓" : preTradeUrl ? "Pre-trade ✓" : postTradeUrl ? "Post-trade ✓" : "Optional"}
          </span>
        </button>
      </div>
      {showScreenshots && (
        <ScreenshotLinksModal
          preTradeUrl={preTradeUrl}
          postTradeUrl={postTradeUrl}
          onSave={(links) => { setPreTradeUrl(links.preTradeUrl); setPostTradeUrl(links.postTradeUrl); }}
          onClose={() => setShowScreenshots(false)}
        />
      )}
      {showExtras && (
        <FormPopup
          title="Stop loss, targets & fees"
          description="All optional. Levels are for review and planned R:R; fees fold into the P&L."
          onClose={() => setShowExtras(false)}
        >
          <div className="flex flex-col gap-3">
          {/* Optional planned levels — both independent; leaving them blank saves as before. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Stop Loss</label>
              <input
                type="number"
                step="any"
                placeholder="optional"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                style={stopLoss ? { ...inputStyle, border: "1px solid rgba(224,82,82,0.45)" } : inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                Take Profit{takeProfits.length > 1 ? "s" : ""}
              </label>
              {takeProfits.map((tp, i) => (
                <div key={i} className="flex items-center gap-1">
                  {takeProfits.length > 1 && (
                    <span className="text-[10px] w-6 shrink-0" style={{ color: "var(--color-text-muted)" }}>TP{i + 1}</span>
                  )}
                  <input
                    type="number"
                    step="any"
                    placeholder="optional"
                    value={tp}
                    onChange={(e) => setTakeProfits((list) => list.map((v, k) => (k === i ? e.target.value : v)))}
                    style={tp ? { ...inputStyle, border: "1px solid rgba(123,193,59,0.45)" } : inputStyle}
                  />
                  {takeProfits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTakeProfits((list) => list.filter((_, k) => k !== i))}
                      aria-label={`Remove target ${i + 1}`}
                      className="shrink-0 w-6 h-6 grid place-content-center rounded hover:opacity-70"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              ))}
              {takeProfits.length < MAX_TAKE_PROFITS && (
                <button
                  type="button"
                  onClick={() => setTakeProfits((list) => [...list, ""])}
                  className="self-start text-[10px] font-semibold"
                  style={{ color: "var(--color-green-primary)" }}
                >
                  + Add target
                </button>
              )}
            </div>
          </div>
          {(plannedRR !== null || stopWrongSide || targetWrongSide) && (
            <div className="flex flex-col gap-0.5 -mt-1 text-[10px]">
              {plannedRR !== null && (
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Planned R:R <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>1 : {plannedRR.toFixed(2)}</span> (to the nearest target)
                </span>
              )}
              {stopWrongSide && (
                <span style={{ color: "#f5a524" }}>
                  Stop is on the profit side of entry for a {isLong ? "long" : "short"} — fine for a breakeven/trailing stop.
                </span>
              )}
              {targetWrongSide && (
                <span style={{ color: "#f5a524" }}>A target is on the loss side of entry for a {isLong ? "long" : "short"} — double-check it.</span>
              )}
            </div>
          )}
          {/* Short single-line labels + items-end keep the two boxes level; the "always deducted"
              note sits under the row instead of wrapping the Commission label. */}
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
              <div className="flex flex-col gap-1"><label className="text-[10px] whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>Swap</label><input type="number" step="any" placeholder="0.00 (optional)" value={swap} onChange={(e) => setSwap(e.target.value)} style={inputStyle} /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] whitespace-nowrap" style={{ color: "var(--color-text-muted)" }} title="Commission / fees">Commission / Fees</label><input type="number" step="any" placeholder="0.00 (optional)" value={commission} onChange={(e) => setCommission(e.target.value)} style={inputStyle} /></div>
            </div>
            <p className="text-[10px]" style={{ color: "var(--color-text-disabled)" }}>
              Commission / fees are always deducted, with or without a minus. Swap keeps its sign (brokers can pay it).
            </p>
          </div>
          </div>
        </FormPopup>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>P&L</label>
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: "var(--color-text-muted)" }}>
            <input type="checkbox" checked={pnlOverride} onChange={(e) => setPnlOverride(e.target.checked)} className="cursor-pointer" />
            Override
          </label>
        </div>
        {pnlOverride ? (
          <input type="number" step="any" placeholder="0.00" value={manualPnl} onChange={(e) => setManualPnl(e.target.value)} style={inputStyle} />
        ) : (
          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Auto-calculated</span>
            <span className="text-[11px] font-semibold" style={{ color: computedPnl === null ? "var(--color-text-disabled)" : computedPnl >= 0 ? "var(--color-green-primary)" : "var(--color-danger)" }}>
              {computedPnl === null ? "— enter exit price" : `${computedPnl >= 0 ? "+" : "-"}$${Math.abs(computedPnl).toFixed(2)}`}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {/* "Mistake?" sits on the Notes line (same label+checkbox pattern as P&L Override); when
            ticked, Notes becomes the required description of the mistake. */}
        <div className="flex items-center justify-between">
          <label className="text-[10px]" style={{ color: isMistake ? "var(--color-danger)" : "var(--color-text-muted)" }}>
            {isMistake ? "What was the mistake?" : "Notes"}
          </label>
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: isMistake ? "var(--color-danger)" : "var(--color-text-muted)" }}>
            <input
              type="checkbox"
              checked={isMistake}
              onChange={(e) => { setIsMistake(e.target.checked); if (!e.target.checked) clearMissing("Mistake description"); }}
              className="cursor-pointer"
              style={{ accentColor: "var(--color-danger)" }}
            />
            Mistake?
          </label>
        </div>
        <textarea
          placeholder={isMistake ? "e.g. Entered before confirmation, moved my stop, oversized…" : "Trade notes, setup, emotions..."}
          rows={3}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); clearMissing("Mistake description"); }}
          style={{
            ...inputStyle,
            resize: "none",
            ...(isMistake
              ? {
                  border: `1px solid ${missingFields.includes("Mistake description") ? "var(--color-danger)" : "rgba(224,82,82,0.45)"}`,
                  backgroundColor: "rgba(224,82,82,0.04)",
                }
              : {}),
          }}
        />
      </div>
      {missingFields.length > 0 && (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
          Missing required field{missingFields.length > 1 ? "s" : ""}: {missingFields.map((f) => (f === "Lot Size" ? sizeSpec.sizeLabel : f)).join(", ")}
        </p>
      )}
      {dateError && (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
          {dateError.field}: {dateError.message}
        </p>
      )}
      {mutation.isError && (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
          {mutation.error instanceof ApiError ? mutation.error.message : `Failed to ${isEdit ? "save" : "add"} trade.`}
        </p>
      )}
      <button type="submit" className="neon-btn w-full rounded-lg py-2.5 text-sm font-semibold" disabled={mutation.isPending} style={{ opacity: mutation.isPending ? 0.6 : 1 }}>
        {mutation.isPending ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Trade"}
      </button>
    </form>
  );
}
