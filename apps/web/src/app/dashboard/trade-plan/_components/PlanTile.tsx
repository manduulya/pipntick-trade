"use client";

import { useEffect, useRef, useState } from "react";
import type { RuleSnapshotItem, TradeGrade, TradePlan, UpdatePlanInput } from "@pipntick/shared";
import { TRADE_GRADES, isRuleMet } from "@pipntick/shared";
import { useDeletePlan, useDeleteTrade, useUpdatePlan } from "../../../../lib/hooks";
import { ApiError } from "../../../../lib/api";
import { GRADE_COLORS, choiceTone, planProgress, toAnswers } from "../../../../lib/trade-plan-utils";
import {
  findInstrument,
  loadStockInstruments,
  stockInstrumentsLoaded,
  useStockInstrumentsLoaded,
} from "../../../../lib/instruments";
import InstrumentInput from "../../InstrumentInput";

const GREEN = "#7cc943";
const GREEN_TEXT = "#8fd14f";
const RED = "#f05252";
const AMBER = "#f5a524";
const CYAN = "#22d3ee";

const STATUS_LABEL = { planned: "Planned", logged: "✓ Logged", skipped: "Skipped" } as const;
const STATUS_COLOR = { planned: CYAN, logged: GREEN_TEXT, skipped: "var(--color-text-secondary)" } as const;

export default function PlanTile({
  plan,
  open,
  onToggle,
  onLog,
  dragging = false,
  onDragStart,
  onDragEnd,
}: {
  plan: TradePlan;
  open: boolean;
  onToggle: () => void;
  /** Opens the Add Trade flow for this plan; the page links the created trade back. */
  onLog: (plan: TradePlan) => void;
  /** This tile is the one currently being dragged to another day. */
  dragging?: boolean;
  onDragStart?: (plan: TradePlan) => void;
  onDragEnd?: () => void;
}) {
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const deleteJournalTrade = useDeleteTrade();
  // Undo on a logged plan first asks whether the Journal trade should go too.
  const [undoAsk, setUndoAsk] = useState(false);
  const [symbol, setSymbol] = useState(plan.symbol);
  const [symbolError, setSymbolError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Expanded tiles only become draggable when the press starts on empty chrome, never on a
  // field/button/label — otherwise selecting text in the symbol input would start a drag.
  const [dragArmed, setDragArmed] = useState(false);
  const symbolFocused = useRef(false);
  const commitSeq = useRef(0);
  // Latest plan for patches fired after an await (commitSymbol) — its closure would otherwise hold
  // a stale plan and write back e.g. a checkbox state from before a click made in the meantime.
  const planRef = useRef(plan);
  planRef.current = plan;

  // Re-render once the stock list arrives so stock tickers resolve as listed.
  useStockInstrumentsLoaded();
  // Only a listed instrument counts as a symbol — the plan can't be logged or skipped until then.
  const instrument = findInstrument(symbol);

  // Follow server-side symbol changes, but never clobber what the user is typing.
  useEffect(() => {
    if (!symbolFocused.current) setSymbol(plan.symbol);
  }, [plan.symbol]);

  const { met, total, allMet } = planProgress(plan.rulesSnapshot);
  const gradeColor = plan.grade ? GRADE_COLORS[plan.grade].bg : null;
  const dirColor = plan.direction === "long" ? GREEN_TEXT : RED;
  const dirArrow = plan.direction === "long" ? "▲" : "▼";
  const isPlanned = plan.status === "planned";
  // Skipped/logged plans are a record of the decision — read-only until Undo reopens them. The API
  // rejects edits to them as well.
  const locked = !isPlanned;

  function patch(next: Partial<TradePlan>, input: UpdatePlanInput) {
    updatePlan.mutate({ next: { ...planRef.current, ...next }, input });
  }

  /** Saves the typed/picked symbol if it's a listed instrument (canonicalized, e.g. "eurusd" ->
   * "EUR/USD"); an unlisted one is kept in the field, flagged, and never saved. Empty clears it. */
  async function commitSymbol(value: string) {
    const seq = ++commitSeq.current;
    const v = value.trim();
    if (!v) {
      setSymbolError(false);
      if (planRef.current.symbol) patch({ symbol: "" }, { symbol: "" });
      return;
    }
    if (!stockInstrumentsLoaded()) await loadStockInstruments();
    if (seq !== commitSeq.current) return; // a newer commit (e.g. a pick) superseded this one
    const inst = findInstrument(v);
    if (!inst) {
      setSymbolError(true);
      return;
    }
    setSymbol(inst.symbol);
    setSymbolError(false);
    if (inst.symbol !== planRef.current.symbol) patch({ symbol: inst.symbol }, { symbol: inst.symbol });
  }

  function setRule(index: number, change: Partial<RuleSnapshotItem>) {
    const rules = plan.rulesSnapshot.map((r, i) => (i === index ? { ...r, ...change } : r));
    patch({ rulesSnapshot: rules }, { answers: toAnswers(rules) });
  }

  function setGrade(g: TradeGrade) {
    const grade = plan.grade === g ? null : g;
    patch({ grade }, { grade });
  }

  function skip() {
    patch({ status: "skipped" }, { status: "skipped" });
    onToggle();
  }

  /** Reopens a skipped/logged plan for editing. `deleteTrade` also removes the linked Journal
   * trade (asked explicitly — undoing a log doesn't by itself mean the trade didn't happen). */
  function undo(deleteTrade = false) {
    const tradeId = plan.journalTradeId;
    const reopen = () => {
      setUndoAsk(false);
      patch({ status: "planned", journalTradeId: null }, { status: "planned", journalTradeId: null });
    };
    if (deleteTrade && tradeId) deleteJournalTrade.mutate(tradeId, { onSuccess: reopen });
    else reopen();
  }

  // Only still-open plans move between days (skipped/logged are records of that day). The API
  // enforces the same rule.
  const canDrag = isPlanned && !!onDragStart;
  const draggable = canDrag && (!open || dragArmed);

  const cardStyle: React.CSSProperties = {
    borderRadius: 10,
    backgroundColor: "var(--color-bg-card)",
    border: `1px solid ${open ? "var(--color-border-hover)" : "var(--color-border-subtle)"}`,
    opacity: dragging ? 0.4 : plan.status === "skipped" && !open ? 0.6 : 1,
    boxShadow: `inset 3px 0 0 ${gradeColor ?? "var(--color-border)"}`,
    transition: "opacity 0.2s ease, border-color 0.2s ease",
  };

  const errorMessage =
    updatePlan.error instanceof ApiError ? updatePlan.error.message : updatePlan.isError ? "Couldn't save that change." : null;

  // Waterfall reveal: each section of the expanded tile fades/slides in a beat after the one above
  // it (see .plan-cascade in globals.css). Capped so long checklists don't trail on forever.
  const cascade = (i: number) => ({ "--i": Math.min(i, 14) }) as React.CSSProperties;
  const rulesStart = 2;
  const afterRules = rulesStart + plan.rulesSnapshot.length;

  // Both faces stay mounted and swap via .plan-fold's animated grid-row height (0fr <-> 1fr), so
  // expanding/collapsing slides smoothly instead of snapping. The hidden face is `inert` so it
  // can't be tabbed into.
  return (
    <article
      className="shrink-0"
      data-open={open}
      style={{ ...cardStyle, cursor: draggable && !open ? "grab" : undefined }}
      draggable={draggable}
      onPointerDown={(e) => {
        if (!canDrag || !open) return;
        setDragArmed(!(e.target as HTMLElement).closest("input, button, label, textarea, [role='group'] button"));
      }}
      onPointerUp={() => setDragArmed(false)}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", plan.id); // required for Firefox to start the drag
        onDragStart?.(plan);
      }}
      onDragEnd={() => {
        setDragArmed(false);
        onDragEnd?.();
      }}
    >
      <div className="plan-fold" style={{ gridTemplateRows: open ? "0fr" : "1fr", opacity: open ? 0 : 1 }} inert={open}>
        <div className="min-h-0 overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded="false"
          className="focus-ring w-full flex flex-col gap-1.5 px-3 py-2.5 text-left rounded-[10px]"
          style={{ color: "var(--color-text-primary)" }}
        >
          <span className="flex items-center justify-between w-full gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[15px] font-extrabold truncate">{plan.symbol || "New plan"}</span>
              <span className="text-[11px]" style={{ color: dirColor }}>{dirArrow}</span>
            </span>
            <span
              className="shrink-0 min-w-[34px] text-center rounded-md text-[13px] font-extrabold"
              style={{
                padding: "2px 7px",
                border: `1px solid ${gradeColor ?? "var(--color-border)"}`,
                color: gradeColor ?? "var(--color-text-secondary)",
              }}
            >
              {plan.grade ?? "–"}
            </span>
          </span>
          <span className="flex items-center justify-between w-full text-xs" style={{ color: "var(--color-text-secondary)" }}>
            <span className="font-extrabold" style={{ color: STATUS_COLOR[plan.status] }}>{STATUS_LABEL[plan.status]}</span>
            <span>{met}/{total} checks</span>
          </span>
        </button>
        </div>
      </div>

      <div className="plan-fold" style={{ gridTemplateRows: open ? "1fr" : "0fr" }} inert={!open}>
      <div className="min-h-0 overflow-hidden">
      <div className="flex flex-col gap-2.5 px-3 pt-2.5 pb-3">
        {/* Symbol · direction · delete · minimize */}
        <div className="plan-cascade flex items-center gap-1.5" style={cascade(0)}>
          {/* display:contents fieldset — disabling it natively disables every control inside
              without changing the row's flex layout. Minimize stays outside so it always works. */}
          <fieldset disabled={locked} className="plan-lock contents">
          <InstrumentInput
            portal
            value={symbol}
            placeholder="Symbol"
            onChange={(v) => { setSymbol(v.toUpperCase()); setSymbolError(false); }}
            onSelect={(s) => { setSymbol(s); commitSymbol(s); }}
            inputProps={{
              "aria-label": "Symbol",
              "aria-invalid": symbolError,
              maxLength: 20,
              onFocus: () => { symbolFocused.current = true; },
              onBlur: () => { symbolFocused.current = false; commitSymbol(symbol); },
              onKeyDown: (e) => { if (e.key === "Enter") e.currentTarget.blur(); },
            }}
            className="focus-ring w-full text-[13px] font-bold uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal placeholder:font-medium"
            style={{
              backgroundColor: "var(--color-bg-base)",
              border: `1px solid ${symbolError ? "var(--color-danger)" : "var(--color-border)"}`,
              borderRadius: 7,
              color: "var(--color-text-primary)",
              padding: "6px 9px",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => {
              const direction = plan.direction === "long" ? "short" : "long";
              patch({ direction }, { direction });
            }}
            aria-label={`Direction: ${plan.direction}. Click to switch.`}
            className="focus-ring press-scale shrink-0 w-[30px] h-[30px] rounded-[7px] text-xs font-extrabold"
            style={{ border: `1px solid ${dirColor}`, color: dirColor }}
          >
            {dirArrow}
          </button>
          {confirmDelete ? (
            <button
              type="button"
              onClick={() => deletePlan.mutate(plan.id)}
              onBlur={() => setConfirmDelete(false)}
              autoFocus
              disabled={deletePlan.isPending}
              className="focus-ring shrink-0 h-[30px] px-2 rounded-[7px] text-[11px] font-extrabold"
              style={{ border: `1px solid ${RED}`, color: RED }}
            >
              {deletePlan.isPending ? "…" : "Delete?"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete plan"
              className="focus-ring press-scale shrink-0 w-7 h-[30px] grid place-content-center rounded-[7px]"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          )}
          </fieldset>
          <button
            type="button"
            onClick={() => { if (!locked) commitSymbol(symbol); onToggle(); }}
            aria-label="Minimize"
            aria-expanded="true"
            className="focus-ring press-scale shrink-0 w-7 h-[30px] grid place-content-center rounded-[7px]"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 15l6-6 6 6" /></svg>
          </button>
        </div>

        {/* Checklist progress */}
        <div className="plan-cascade flex flex-col gap-1.5" style={cascade(1)}>
          <div className="flex justify-between text-[11px] font-extrabold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)" }}>
            <span>Checklist</span>
            <span>{met}/{total}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-border-subtle)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${total ? Math.round((met / total) * 100) : 0}%`, backgroundColor: allMet ? GREEN : AMBER, transition: "width 0.2s ease, background-color 0.2s ease" }}
            />
          </div>
        </div>

        {/* Rules + grade: read-only once the plan is skipped/logged (see `locked`). */}
        <fieldset disabled={locked} className="plan-lock contents">
        <div className="flex flex-col gap-2">
          {total === 0 && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              No rules on this plan. Add some under My Rules — they apply to new plans.
            </p>
          )}
          {plan.rulesSnapshot.map((r, i) => {
            const ok = isRuleMet(r);
            const textColor = ok ? "var(--color-text-primary)" : "var(--color-text-secondary)";
            if (r.type === "check") {
              return (
                <label key={i} className="plan-cascade flex items-start gap-2 text-[13px] leading-snug cursor-pointer" style={{ color: textColor, ...cascade(rulesStart + i) }}>
                  <input
                    type="checkbox"
                    checked={r.done}
                    onChange={() => setRule(i, { done: !r.done })}
                    className="focus-ring shrink-0 mt-px w-4 h-4 cursor-pointer"
                    style={{ accentColor: GREEN }}
                  />
                  <span>{r.text}</span>
                </label>
              );
            }
            // Answered: collapses to one line — question + just the picked pill. Clicking that pill
            // clears it and the full option row cascades back in underneath.
            return (
              <div key={i} role="group" aria-label={r.text} className="plan-cascade flex flex-col gap-1.5" style={cascade(rulesStart + i)}>
                <div className="flex items-center gap-2 text-[13px] leading-snug min-w-0" style={{ color: textColor }}>
                  <span
                    aria-hidden="true"
                    className="shrink-0 w-4 h-4 rounded-full"
                    style={{
                      border: `1.5px solid ${ok ? GREEN : "var(--color-border-hover)"}`,
                      background: ok ? `radial-gradient(${GREEN} 0 3px, transparent 4px)` : "transparent",
                      transition: "border-color 0.2s ease",
                    }}
                  />
                  <span className="min-w-0 flex-1">{r.text}</span>
                  {r.value && (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRule(i, { value: null })}
                      aria-pressed="true"
                      title="Click to change"
                      className="plan-pill-pop focus-ring shrink-0 rounded-full text-xs font-bold"
                      style={(() => {
                        const tone = choiceTone(r.value);
                        return { padding: "3px 10px", border: `1px solid ${tone.border}`, backgroundColor: tone.bg, color: tone.text };
                      })()}
                    >
                      {r.value}
                    </button>
                  )}
                </div>
                {!r.value && (
                  <div className="flex flex-wrap gap-1 pl-6">
                    {r.options.map((o, k) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setRule(i, { value: o })}
                        aria-pressed="false"
                        className="plan-pill-in focus-ring rounded-full text-xs font-bold"
                        style={{
                          padding: "3px 9px",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-secondary)",
                          animationDelay: `${k * 45}ms`,
                          // Hover previews the answer's color (see .plan-pill-in:hover).
                          ["--tone-border" as string]: choiceTone(o).border,
                          ["--tone-text" as string]: choiceTone(o).text,
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grade */}
        <div className="plan-cascade flex flex-col gap-1.5 pt-2" style={{ borderTop: "1px solid var(--color-border-subtle)", ...cascade(afterRules) }}>
          <span className="text-[11px] font-extrabold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)" }}>Trade quality</span>
          <div className="grid grid-cols-6 gap-[3px]" role="group" aria-label="Trade quality grade">
            {TRADE_GRADES.map((g) => {
              const on = plan.grade === g;
              const c = GRADE_COLORS[g];
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  aria-pressed={on}
                  className="focus-ring h-8 rounded-md text-xs font-extrabold"
                  style={{ border: `1px solid ${on ? c.bg : "var(--color-border)"}`, backgroundColor: on ? c.bg : "transparent", color: on ? c.fg : c.bg }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
        </fieldset>

        {/* Actions */}
        {isPlanned ? (
          <div className="plan-cascade flex flex-col gap-2.5" style={cascade(afterRules + 1)}>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => { if (instrument) { commitSymbol(instrument.symbol); skip(); } }}
                disabled={!instrument}
                className="focus-ring press-scale flex-1 py-2 px-1 rounded-lg text-xs font-bold"
                style={{
                  border: "1px solid var(--color-border)",
                  color: instrument ? "var(--color-text-secondary)" : "var(--color-text-muted)",
                  cursor: instrument ? "pointer" : "not-allowed",
                  opacity: instrument ? 1 : 0.6,
                }}
              >
                Skip this trade
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!instrument) return;
                  commitSymbol(instrument.symbol);
                  onLog({ ...plan, symbol: instrument.symbol });
                }}
                disabled={!plan.grade || !instrument}
                className="focus-ring press-scale flex-1 py-2 px-1 rounded-lg text-xs font-extrabold"
                style={
                  plan.grade && instrument
                    ? { backgroundColor: GREEN, color: "#0a1206" }
                    : { backgroundColor: "var(--color-border-subtle)", color: "var(--color-text-muted)", cursor: "not-allowed" }
                }
              >
                Log to Journal
              </button>
            </div>
            {(!instrument || !plan.grade) && (
              <span className="text-[11px] text-center" style={{ color: symbolError ? "var(--color-danger)" : "var(--color-text-secondary)" }}>
                {!instrument
                  ? symbolError
                    ? `“${symbol}” isn’t listed — pick a symbol from the list`
                    : "Pick a symbol from the list"
                  : "Grade the setup to log it"}
              </span>
            )}
          </div>
        ) : (
          <div className="plan-cascade flex flex-col gap-2 text-xs" style={cascade(afterRules + 1)}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold" style={{ color: STATUS_COLOR[plan.status] }}>{STATUS_LABEL[plan.status]}</span>
              {!undoAsk && (
                <button
                  type="button"
                  // A logged plan with a linked trade asks what to do with that trade; a skipped
                  // plan (or one whose trade was already deleted in the Journal) just reopens.
                  onClick={() => (plan.status === "logged" && plan.journalTradeId ? setUndoAsk(true) : undo())}
                  className="focus-ring font-bold underline"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Undo
                </button>
              )}
            </div>
            {!undoAsk && (
              <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                Locked — undo to make changes
              </span>
            )}
            {undoAsk && (
              <div
                className="plan-pill-in flex flex-col gap-2 rounded-lg p-2.5"
                style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}
              >
                <span className="text-[12px] leading-snug" style={{ color: "var(--color-text-primary)" }}>
                  Reopen this plan. What about the trade in your Journal?
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => undo(false)}
                    disabled={deleteJournalTrade.isPending}
                    className="focus-ring press-scale flex-1 py-1.5 rounded-md font-bold"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                  >
                    Keep trade
                  </button>
                  <button
                    type="button"
                    onClick={() => undo(true)}
                    disabled={deleteJournalTrade.isPending}
                    className="focus-ring press-scale flex-1 py-1.5 rounded-md font-bold"
                    style={{ border: `1px solid ${RED}`, color: RED, opacity: deleteJournalTrade.isPending ? 0.6 : 1 }}
                  >
                    {deleteJournalTrade.isPending ? "Deleting…" : "Delete trade"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setUndoAsk(false)}
                  className="focus-ring self-center text-[11px] underline"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {deleteJournalTrade.isError && (
          <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
            Couldn&rsquo;t delete the Journal trade, so the plan was left as is.
          </p>
        )}
        {errorMessage && <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{errorMessage}</p>}
      </div>
      </div>
      </div>
    </article>
  );
}
