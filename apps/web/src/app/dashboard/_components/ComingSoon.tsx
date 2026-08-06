export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="rounded-full p-4" style={{ backgroundColor: "rgba(123,193,59,0.08)" }}>
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#7bc13b" strokeWidth={1.75}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
        </svg>
      </div>
      <h1 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>{title}</h1>
      <p className="text-sm max-w-sm" style={{ color: "#8899aa" }}>{description}</p>
      <span
        className="mt-2 px-3 py-1 rounded-full text-[11px] font-semibold"
        style={{ backgroundColor: "rgba(123,193,59,0.12)", color: "#7bc13b", border: "1px solid rgba(123,193,59,0.3)" }}
      >
        Coming Soon
      </span>
    </div>
  );
}
