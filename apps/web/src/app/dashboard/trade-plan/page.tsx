"use client";

import { useMemo, useState } from "react";
import type { TradePlan } from "@pipntick/shared";
import { useCreatePlan, usePlans, useRules } from "../../../lib/hooks";
import { useSelectedAccount } from "../../../lib/account-context";
import { ApiError } from "../../../lib/api";
import { addWeeks, formatWeekRange, startOfWeek, toDateKey, weekDays, weekSummary } from "../../../lib/trade-plan-utils";
import EmptyAccountsState from "../EmptyAccountsState";
import Toast from "../Toast";
import RulesDrawer from "../_components/RulesDrawer";
import PlanTile from "./_components/PlanTile";
import LogTradeModal from "./_components/LogTradeModal";

const CYAN = "#22d3ee";
const GREEN = "#7cc943";

export default function TradePlanPage() {
  const { accounts, accountsLoading, selectedAccountId } = useSelectedAccount();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const from = toDateKey(days[0]);
  const to = toDateKey(days[6]);
  const todayKey = toDateKey(new Date());
  const isThisWeek = from === toDateKey(startOfWeek(new Date()));

  const { data: plans, isLoading, isError, error } = usePlans(from, to);
  const { data: rules } = useRules();
  const createPlan = useCreatePlan();

  // Expanded/collapsed is view state only — never persisted, so every tile starts collapsed on load.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [rulesOpen, setRulesOpen] = useState(false);
  const [loggingPlan, setLoggingPlan] = useState<TradePlan | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const plansByDay = useMemo(() => {
    const map = new Map<string, TradePlan[]>();
    for (const p of plans ?? []) map.set(p.planDate, [...(map.get(p.planDate) ?? []), p]);
    return map;
  }, [plans]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPlan(dayKey: string) {
    createPlan.mutate(dayKey, {
      onSuccess: (plan) => {
        // The new tile opens; the rest of that day's column collapses so it isn't lost in the scroll.
        const sameDay = new Set((plansByDay.get(dayKey) ?? []).map((p) => p.id));
        setOpenIds((prev) => new Set([...[...prev].filter((id) => !sameDay.has(id)), plan.id]));
      },
    });
  }

  if (!accountsLoading && accounts.length === 0) {
    return <EmptyAccountsState />;
  }

  const ruleCount = rules?.length ?? 0;

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>Trade Plan</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            aria-label="Previous week"
            className="focus-ring press-scale w-8 h-8 grid place-content-center rounded-lg"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span className="text-base font-extrabold text-center min-w-[170px]" style={{ color: "var(--color-text-primary)" }}>
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            aria-label="Next week"
            className="focus-ring press-scale w-8 h-8 grid place-content-center rounded-lg"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            disabled={isThisWeek}
            className="focus-ring press-scale px-3.5 py-[7px] rounded-lg text-[13px] font-bold"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", opacity: isThisWeek ? 0.5 : 1 }}
          >
            This week
          </button>
          {plans && (
            <span className="text-[13px] ml-1" style={{ color: "var(--color-text-secondary)" }}>{weekSummary(plans)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="focus-ring press-scale flex items-center gap-2 px-4 py-[9px] rounded-lg text-sm font-extrabold"
          style={{ backgroundColor: GREEN, color: "#0a1206", boxShadow: "0 0 18px rgba(124,201,67,0.3)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>
          My Rules · {ruleCount}
        </button>
      </div>

      {createPlan.isError && (
        <p className="text-xs shrink-0" style={{ color: "var(--color-danger)" }}>
          {createPlan.error instanceof ApiError ? createPlan.error.message : "Couldn't add the plan."}
        </p>
      )}

      {/* Week grid — 7 columns Sun–Sat, each scrolling on its own. Columns keep a minimum width and
          the row scrolls sideways on narrower screens instead of squashing the tiles. */}
      <div className="plan-scroll flex-1 min-h-0 overflow-x-auto">
        {isError ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs" style={{ color: "var(--color-danger)" }}>
              {error instanceof ApiError ? error.message : "Couldn't load your plans."}
            </p>
          </div>
        ) : (
          <div className="h-full grid gap-2.5" style={{ gridTemplateColumns: "repeat(7, minmax(210px, 1fr))" }}>
            {days.map((day, i) => {
              const key = toDateKey(day);
              const isToday = key === todayKey;
              const dayPlans = plansByDay.get(key) ?? [];
              return (
                <section
                  key={key}
                  aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  className="flex flex-col min-w-0 min-h-0 rounded-xl"
                  style={{
                    backgroundColor: "var(--color-bg-surface)",
                    border: `1px solid ${isToday ? CYAN : "var(--color-border)"}`,
                    boxShadow: isToday ? "0 0 0 1px rgba(34,211,238,0.15)" : undefined,
                  }}
                >
                  <div className="flex items-baseline justify-between px-3 pt-3 pb-2.5" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: isToday ? CYAN : "var(--color-text-secondary)" }}>
                        {day.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="text-xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>{day.getDate()}</span>
                    </div>
                    <span className="text-[11px]" style={{ color: isToday ? CYAN : "var(--color-text-secondary)" }}>
                      {isToday ? "Today" : i === 0 ? "Market opens 5 PM" : ""}
                    </span>
                  </div>
                  <div className="plan-scroll flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                    {isLoading || !selectedAccountId ? (
                      <div className="h-16 rounded-[10px] animate-pulse" style={{ backgroundColor: "var(--color-bg-card)" }} />
                    ) : (
                      dayPlans.map((plan) => (
                        <PlanTile
                          key={plan.id}
                          plan={plan}
                          open={openIds.has(plan.id)}
                          onToggle={() => toggle(plan.id)}
                          onLog={setLoggingPlan}
                        />
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => addPlan(key)}
                      disabled={createPlan.isPending || !selectedAccountId}
                      className="focus-ring press-scale shrink-0 p-2.5 rounded-[10px] text-[13px] font-bold"
                      style={{ border: "1px dashed var(--color-border)", color: "var(--color-text-secondary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-green-primary)"; e.currentTarget.style.borderColor = "var(--color-green-primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                    >
                      + Add plan
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      {loggingPlan && (
        <LogTradeModal
          plan={loggingPlan}
          onClose={() => setLoggingPlan(null)}
          onSaved={(message) => {
            setOpenIds((prev) => {
              const next = new Set(prev);
              next.delete(loggingPlan.id);
              return next;
            });
            setToast(message);
          }}
        />
      )}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
