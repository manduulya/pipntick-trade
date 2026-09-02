"use client";

import { useEffect, useState } from "react";
import type { CreateTradeInput, ParsedTradeScreenshot, Trade } from "@pipntick/shared";
import { getContractSize } from "@pipntick/shared";
import { useCreateTrade, useUpdateTrade } from "../../../lib/hooks";
import { useSelectedAccount } from "../../../lib/account-context";
import { ApiError } from "../../../lib/api";
import { brokerWallClockToUtc, formatUtcOffsetLabel } from "../../../lib/time-format";
import { detectSession, toDatetimeLocal } from "../../../lib/trade-utils";
import InstrumentInput from "../InstrumentInput";
import DateTimePicker from "./DateTimePicker";

// Shared by Dashboard's inline quick-add panel and Journal's Add/Edit modal — both wrap this in
// their own tabs/chrome (manual vs screenshot, modal vs inline card), but the manual-entry fields
// themselves were previously two hand-copied implementations that had already drifted (Journal
// had gained a P&L override + missing-field validation that Dashboard's copy never got).

export type EntryMethod = "manual" | "screenshot";

export const entryTabs: { id: EntryMethod; label: string; icon: React.ReactNode }[] = [
  {
    id: "manual",
    label: "Manual",
    icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: "screenshot",
    label: "Screenshot",
    icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

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
}: {
  /** Present -> edit an existing trade. Absent -> create a new one. */
  trade?: Trade;
  /** OCR-parsed screenshot data to prefill a fresh create with. Ignored in edit mode. */
  prefill?: ParsedTradeScreenshot | null;
  onSaved: (message: string) => void;
  /** Closes the surrounding modal on success. Omit for a persistent inline panel (e.g. Dashboard's
   * quick-add card) — the form resets itself in place instead so it's ready for the next entry. */
  onDone?: () => void;
}) {
  const isEdit = !!trade;
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const mutation = isEdit ? updateTrade : createTrade;
  const { selectedAccount } = useSelectedAccount();
  // Trade times are entered, displayed, stored and day-bucketed in the account's broker-server
  // timezone (what the user sees on their platform / screenshots) — the raw wall-clock digits,
  // never converted, same as lib/trade-utils.ts documents. This offset is only used to shift back
  // to a real instant for the three things that actually reason in real time: the "not in the
  // future" and account-start checks, and the London/NY/Tokyo session lookup. 0 (or unset) keeps
  // the fields as plain UTC.
  const offsetMinutes = selectedAccount?.brokerUtcOffsetMinutes ?? 0;
  const tzLabel = formatUtcOffsetLabel(offsetMinutes);
  // Bounds for entry/exit: can't predate the account's own start date, can't be in the future.
  // Both the input's native min/max (best-effort, browser-dependent) and an explicit submit-time
  // check below, since not every browser enforces datetime-local min/max in its picker UI. Both
  // bounds are real instants shifted into broker wall-clock to match the field's own scale.
  const toBrokerWallClock = (instant: Date) => {
    const shifted = new Date(instant.getTime() + offsetMinutes * 60_000);
    return Number.isNaN(shifted.getTime()) ? "" : toDatetimeLocal(shifted.toISOString());
  };
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
  const [pnlOverride, setPnlOverride] = useState(trade?.pnlManual ?? false);
  const [manualPnl, setManualPnl] = useState(trade?.pnl ?? "");
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // The exact string values the edit form opened with, so submit can send only the optional
  // fields the user actually changed. Sending every optional every time re-asserts the whole
  // trade — which e.g. reopens a closed trade if the exit-price field happens to render empty.
  const initial = {
    exitPrice: trade ? trimTrailingZeros(trade.exitPrice) : "",
    exitDateTime: toDatetimeLocal(trade?.exitTime),
    swap: trade?.swap ?? "",
    commission: trade?.commission ?? "",
    notes: trade?.notes ?? "",
    pnlOverride: trade?.pnlManual ?? false,
    manualPnl: trade?.pnl ?? "",
  };
  const [dateError, setDateError] = useState<{ field: string; message: string } | null>(null);
  // Session boundaries (London/NY/Tokyo) are defined in UTC hours, so match against the UTC time,
  // not the raw broker wall-clock the field holds. Guard the ISO call against a not-yet-complete
  // field value so a half-typed date can't throw on render.
  const entryInstant = entryDateTime ? brokerWallClockToUtc(entryDateTime, offsetMinutes) : null;
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
    const instant = brokerWallClockToUtc(value, offsetMinutes);
    if (selectedAccount && instant < new Date(selectedAccount.createdAt)) {
      return "Can't be before the account's start date";
    }
    if (instant > new Date()) {
      return "Can't be in the future";
    }
    return null;
  }

  const missingInputStyle = { ...inputStyle, border: "1px solid var(--color-danger)" };

  const computedPnl =
    entryPrice !== "" && exitPrice !== "" && lotSize !== ""
      ? (direction === "long" ? Number(exitPrice) - Number(entryPrice) : Number(entryPrice) - Number(exitPrice)) *
          Number(lotSize) *
          getContractSize(symbol) +
        (swap !== "" ? Number(swap) : 0) +
        (commission !== "" ? Number(commission) : 0)
      : null;

  function resetFields() {
    setSymbol(""); setEntryPrice(""); setExitPrice("");
    setEntryDateTime(""); setExitDateTime(""); setLotSize("");
    setSwap(""); setCommission(""); setNotes("");
    setPnlOverride(false); setManualPnl(""); setMissingFields([]); setDateError(null);
  }

  function handleSuccess(message: string) {
    onSaved(message);
    if (onDone) onDone();
    else resetFields();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const missing: string[] = [];
    if (!symbol) missing.push("Instrument");
    if (!entryPrice) missing.push("Entry Price");
    if (!lotSize) missing.push("Lot Size");
    if (!entryDateTime) missing.push("Entry Date & Time");
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

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
      symbol,
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
      if (overridePnl !== null) input.pnl = overridePnl;
      createTrade.mutate(input, {
        onSuccess: () => handleSuccess("Trade added successfully"),
      });
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <InstrumentInput
        value={symbol}
        onChange={(v) => { setSymbol(v); clearMissing("Instrument"); }}
        style={missingFields.includes("Instrument") ? missingInputStyle : inputStyle}
      />
      <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
        {(["long", "short"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDirection(d)} className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all"
            style={{
              backgroundColor: direction === d ? (d === "long" ? "rgba(123,193,59,0.2)" : "rgba(239,68,68,0.2)") : "transparent",
              color: direction === d ? (d === "long" ? "var(--color-green-neon)" : "var(--color-danger)") : "var(--color-text-muted)",
              border: direction === d ? `1px solid ${d === "long" ? "rgba(123,193,59,0.4)" : "rgba(239,68,68,0.4)"}` : "1px solid transparent",
            }}>
            {d === "long" ? "▲ Long" : "▼ Short"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Entry Price</label><input type="number" step="any" placeholder="0.00" value={entryPrice} onChange={(e) => { setEntryPrice(e.target.value); clearMissing("Entry Price"); }} style={missingFields.includes("Entry Price") ? missingInputStyle : inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Exit Price</label><input type="number" step="any" placeholder="0.00 (optional)" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} style={inputStyle} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Entry Date & Time ({tzLabel})</label><DateTimePicker tzLabel={tzLabel} min={minDateTime} max={maxDateTime} value={entryDateTime} onChange={(v) => { setEntryDateTime(v); clearMissing("Entry Date & Time"); setDateError(null); }} style={missingFields.includes("Entry Date & Time") || dateError?.field === "Entry Date & Time" ? missingInputStyle : inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Exit Date & Time ({tzLabel})</label><DateTimePicker tzLabel={tzLabel} min={entryDateTime || minDateTime} max={maxDateTime} value={exitDateTime} onChange={(v) => { setExitDateTime(v); setDateError(null); }} style={dateError?.field === "Exit Date & Time" ? missingInputStyle : inputStyle} /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Session</span>
        <span className="text-[11px] font-semibold" style={{ color: session ? "var(--color-green-primary)" : "var(--color-text-disabled)" }}>{session || "— enter entry time"}</span>
      </div>
      <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Lot Size</label><input type="number" step="any" placeholder="0.01" value={lotSize} onChange={(e) => { setLotSize(e.target.value); clearMissing("Lot Size"); }} style={missingFields.includes("Lot Size") ? missingInputStyle : inputStyle} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Swap</label><input type="number" step="any" placeholder="0.00 (optional)" value={swap} onChange={(e) => setSwap(e.target.value)} style={inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Commission / Charges</label><input type="number" step="any" placeholder="0.00 (optional)" value={commission} onChange={(e) => setCommission(e.target.value)} style={inputStyle} /></div>
      </div>
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
              {computedPnl === null ? "— enter exit price" : `${computedPnl >= 0 ? "+" : ""}$${Math.abs(computedPnl).toFixed(2)}`}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Notes</label><textarea placeholder="Trade notes, setup, emotions..." rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "none" }} /></div>
      {missingFields.length > 0 && (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
          Missing required field{missingFields.length > 1 ? "s" : ""}: {missingFields.join(", ")}
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
