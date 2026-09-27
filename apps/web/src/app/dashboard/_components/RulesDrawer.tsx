"use client";

import { useEffect, useRef, useState } from "react";
import type { RuleType, SaveRulesInput, TradingRule } from "@pipntick/shared";
import { useRules, useSaveRules } from "../../../lib/hooks";
import { ApiError } from "../../../lib/api";
import { useLockBodyScroll } from "../../../lib/use-lock-body-scroll";

// "My Rules" — the account's one pre-trade checklist. Opened from the Trade Plan toolbar and from
// Settings → Trading rules. Edits a local draft and saves the whole list at once; existing plan
// tiles are unaffected since each carries its own snapshot of the rules it was created with.

const CYAN = "#22d3ee";

const SUGGESTED_RULES: SaveRulesInput = [
  { text: "Weekly trend", type: "choice", options: ["Up", "Sideways", "Down"] },
  { text: "Daily trend", type: "choice", options: ["Up", "Sideways", "Down"] },
  { text: "Session", type: "choice", options: ["Asia", "London", "New York"] },
  { text: "Price is at a key level", type: "check", options: [] },
  { text: "Entry confirmed on my timeframe", type: "check", options: [] },
  { text: "Risk is 1% or less", type: "check", options: [] },
  { text: "Reward : risk at least 1 : 2", type: "check", options: [] },
  { text: "No high-impact news in 30 min", type: "check", options: [] },
  { text: "Calm, not chasing or revenging", type: "check", options: [] },
];

type DraftRule = { key: number; text: string; type: RuleType; options: string[]; optionDraft: string };

let nextKey = 1;
const toDraft = (r: Pick<TradingRule, "text" | "type" | "options">): DraftRule => ({
  key: nextKey++,
  text: r.text,
  type: r.type,
  options: [...r.options],
  optionDraft: "",
});

const fieldStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)",
  borderRadius: 7,
  outline: "none",
  width: "100%",
};

export default function RulesDrawer({ accountId, onClose }: { accountId?: string | null; onClose: () => void }) {
  const { data: rules, isLoading } = useRules(accountId);
  const saveRules = useSaveRules(accountId);
  const [draft, setDraft] = useState<DraftRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  useLockBodyScroll();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Seed the draft once the saved rules arrive (only once, so a background refetch can't wipe
  // in-progress edits).
  useEffect(() => {
    if (rules && draft === null) setDraft(rules.map(toDraft));
  }, [rules, draft]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = draft ?? [];

  function update(key: number, patch: Partial<DraftRule>) {
    setDraft((d) => (d ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setError(null);
  }

  function addOption(key: number) {
    const rule = rows.find((r) => r.key === key);
    const v = rule?.optionDraft.trim();
    if (!rule || !v) return;
    update(key, { options: rule.options.includes(v) ? rule.options : [...rule.options, v], optionDraft: "" });
  }

  function addRule() {
    setDraft((d) => [...(d ?? []), toDraft({ text: "", type: "check", options: [] })]);
    requestAnimationFrame(() => listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  function handleSave() {
    const payload: SaveRulesInput = rows
      .filter((r) => r.text.trim())
      .map((r) => ({ text: r.text.trim(), type: r.type, options: r.type === "choice" ? r.options : [] }));
    const incomplete = payload.find((r) => r.type === "choice" && r.options.length < 2);
    if (incomplete) {
      setError(`"${incomplete.text}" needs at least two options.`);
      return;
    }
    saveRules.mutate(payload, {
      onSuccess: handleClose,
      onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save your rules."),
    });
  }

  const typeTab = (on: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 11px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: on ? 800 : 600,
    backgroundColor: on ? "var(--color-border)" : "transparent",
    color: on ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    cursor: "pointer",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{
        backgroundColor: visible ? "rgba(3,6,12,0.65)" : "rgba(3,6,12,0)",
        transition: "background-color 0.25s ease",
      }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My Rules"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[520px] h-full flex flex-col gap-4 px-5 sm:px-6 py-6"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderLeft: "1px solid var(--color-border)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>My Rules</h2>
            <span className="text-[13px] leading-snug" style={{ color: "var(--color-text-secondary)" }}>
              Your one checklist. Every new plan tile starts with these rules.
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="focus-ring press-scale shrink-0 w-[34px] h-[34px] grid place-content-center rounded-lg"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Rule list */}
        <div className="plan-scroll flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-1">
          {isLoading || draft === null ? (
            <p className="text-xs py-6 text-center" style={{ color: "var(--color-text-muted)" }}>Loading rules…</p>
          ) : (
            <>
              {rows.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-xl py-6 px-4 text-center" style={{ border: "1px dashed var(--color-border)" }}>
                  <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                    No rules yet. Write your own, or start from a suggested set and edit it.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDraft(SUGGESTED_RULES.map(toDraft))}
                    className="focus-ring press-scale rounded-lg px-4 py-2 text-[13px] font-bold"
                    style={{ border: "1px solid var(--color-green-primary)", color: "var(--color-green-primary)" }}
                  >
                    Use suggested rules
                  </button>
                </div>
              )}
              {rows.map((r, i) => {
                const isChoice = r.type === "choice";
                return (
                  <div
                    key={r.key}
                    className="shrink-0 rounded-[10px] p-3 flex flex-col gap-2.5"
                    style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-[18px] shrink-0 text-right text-[13px] font-extrabold" style={{ color: "var(--color-text-secondary)" }}>{i + 1}</span>
                      <input
                        type="text"
                        aria-label="Rule"
                        placeholder={isChoice ? "Question, e.g. Weekly trend" : "Rule, e.g. Risk is 1% or less"}
                        value={r.text}
                        maxLength={200}
                        onChange={(e) => update(r.key, { text: e.target.value })}
                        className="focus-ring text-sm font-bold"
                        style={{ ...fieldStyle, padding: "9px 11px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setDraft((d) => (d ?? []).filter((x) => x.key !== r.key))}
                        aria-label="Delete rule"
                        className="focus-ring press-scale shrink-0 w-9 h-9 grid place-content-center rounded-lg"
                        style={{ border: "1px solid var(--color-border)", color: "var(--color-danger)" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap pl-[26px]">
                      <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>Type</span>
                      <div className="flex gap-[3px] p-[3px] rounded-lg" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border-subtle)" }} role="group" aria-label="Rule type">
                        <button type="button" onClick={() => update(r.key, { type: "check" })} aria-pressed={!isChoice} style={typeTab(!isChoice)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M5 12l5 5 9-10" /></svg>
                          Checkbox
                        </button>
                        <button type="button" onClick={() => update(r.key, { type: "choice" })} aria-pressed={isChoice} style={typeTab(isChoice)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
                          Multiple choice
                        </button>
                      </div>
                    </div>
                    {isChoice && (
                      <div className="flex flex-col gap-2 pl-[26px]">
                        <div className="flex flex-wrap gap-1.5">
                          {r.options.map((o) => (
                            <span
                              key={o}
                              className="inline-flex items-center gap-1 rounded-full text-[13px] font-bold"
                              style={{ padding: "4px 4px 4px 10px", backgroundColor: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.35)", color: CYAN }}
                            >
                              {o}
                              <button
                                type="button"
                                onClick={() => update(r.key, { options: r.options.filter((x) => x !== o) })}
                                aria-label={`Remove option ${o}`}
                                className="w-5 h-5 grid place-content-center rounded-full"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M6 6l12 12M18 6L6 18" /></svg>
                              </button>
                            </span>
                          ))}
                          {r.options.length < 2 && (
                            <span className="text-xs self-center" style={{ color: "#f5a524" }}>Add at least two options</span>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            aria-label="New option"
                            placeholder="Add an option, e.g. Up"
                            value={r.optionDraft}
                            maxLength={60}
                            onChange={(e) => update(r.key, { optionDraft: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(r.key); } }}
                            className="focus-ring text-[13px]"
                            style={{ ...fieldStyle, padding: "8px 10px" }}
                          />
                          <button
                            type="button"
                            onClick={() => addOption(r.key)}
                            className="focus-ring press-scale shrink-0 px-3.5 rounded-[7px] text-[13px] font-extrabold"
                            style={{ border: "1px solid var(--color-border)", color: "var(--color-green-primary)" }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addRule}
                className="focus-ring press-scale shrink-0 p-[11px] rounded-[10px] text-[13px] font-bold"
                style={{ border: "1px dashed var(--color-border)", color: "var(--color-green-primary)" }}
              >
                + Add rule
              </button>
              <div ref={listEndRef} />
            </>
          )}
        </div>

        {/* Note */}
        <div
          className="shrink-0 flex gap-2.5 items-start rounded-[10px] px-3.5 py-3 text-[13px] leading-relaxed"
          style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-secondary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth={2} className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
          Edits apply to new plans. Tiles you already made keep the rules they were checked against.
        </div>

        {error && <p className="shrink-0 text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saveRules.isPending || draft === null}
          className="neon-btn shrink-0 rounded-[10px] py-3 text-[15px] font-extrabold"
          style={{ opacity: saveRules.isPending || draft === null ? 0.6 : 1 }}
        >
          {saveRules.isPending ? "Saving…" : "Save rules"}
        </button>
      </div>
    </div>
  );
}
