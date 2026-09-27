// Small red tag for trades the trader flagged as a mistake (Journal rows, calendar day view).
export default function MistakePill() {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: "rgba(224,82,82,0.12)", border: "1px solid rgba(224,82,82,0.35)", color: "var(--color-danger)" }}
    >
      Mistake
    </span>
  );
}
