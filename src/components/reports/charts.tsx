import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  /** Optional secondary value drawn as a lighter overlay (e.g. actual vs scheduled). */
  secondary?: number;
  display?: string;
}

/** Vertical bar chart built from divs — no charting dependency. */
export function BarChart({ data, height = 180, valuePrefix = "" }: { data: BarDatum[]; height?: number; valuePrefix?: string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2">
          <div className="relative flex w-full items-end justify-center" style={{ height: height - 28 }}>
            {d.secondary !== undefined && (
              <div
                className="absolute bottom-0 w-full rounded-t-sm bg-muted"
                style={{ height: `${(d.secondary / max) * 100}%` }}
                title={`${valuePrefix}${d.secondary}`}
              />
            )}
            <div
              className="relative w-3/5 rounded-t-md transition-all"
              style={{ height: `${(d.value / max) * 100}%`, background: d.color ?? "hsl(var(--primary))", minHeight: d.value > 0 ? 3 : 0 }}
              title={`${valuePrefix}${d.value}`}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars, good for category breakdowns. */
export function HBarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No data for this period.</p>}
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-muted-foreground">{d.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
            <div className="h-full rounded-md"
              style={{ width: `${Math.max((d.value / max) * 100, 8)}%`, background: d.color ?? "hsl(var(--primary))" }} />
          </div>
          <span className="w-16 shrink-0 text-right tabular-nums">{d.display ?? d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "default" | "warning" | "success" }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums",
        tone === "warning" && "text-amber-600 dark:text-amber-400",
        tone === "success" && "text-emerald-600 dark:text-emerald-400")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
