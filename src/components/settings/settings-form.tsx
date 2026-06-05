"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Building2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/layout/page-header";

interface SettingsState {
  name: string; slug: string; timezone: string; currency: string;
  maxWeeklyHours: number; minRestHours: number; overtimeThreshold: number;
  weekStartsOn: number; allowSelfSwap: boolean; requireGpsClockIn: boolean;
}

const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney", "UTC"];
const CURRENCIES = ["GBP", "USD", "EUR", "AUD", "CAD", "INR"];

export function SettingsForm({ initial }: { initial: SettingsState }) {
  const router = useRouter();
  const [s, setS] = React.useState<SettingsState>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  function set<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSaved(false);
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name, timezone: s.timezone, currency: s.currency,
          maxWeeklyHours: s.maxWeeklyHours, minRestHours: s.minRestHours, overtimeThreshold: s.overtimeThreshold,
          weekStartsOn: s.weekStartsOn, allowSelfSwap: s.allowSelfSwap, requireGpsClockIn: s.requireGpsClockIn,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save settings");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company profile and scheduling rules."
        action={
          <Button onClick={save} disabled={busy || !dirty}>
            {busy ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
            {saved && !dirty ? "Saved" : "Save changes"}
          </Button>
        }
      />

      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-5" /> Company</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2"><Label>Company name</Label>
              <Input value={s.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Workspace slug</Label>
              <Input value={s.slug} disabled />
              <p className="text-xs text-muted-foreground">The slug can't be changed.</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Timezone</Label>
                <Select value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </Select></div>
              <div className="grid gap-2"><Label>Currency</Label>
                <Select value={s.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select></div>
            </div>
            <div className="grid gap-2"><Label>Week starts on</Label>
              <Select value={s.weekStartsOn} onChange={(e) => set("weekStartsOn", Number(e.target.value))}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="size-5" /> Scheduling rules</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>Max weekly hrs</Label>
                <Input type="number" min={1} max={168} value={s.maxWeeklyHours} onChange={(e) => set("maxWeeklyHours", Number(e.target.value))} /></div>
              <div className="grid gap-2"><Label>Min rest (hrs)</Label>
                <Input type="number" min={0} max={48} value={s.minRestHours} onChange={(e) => set("minRestHours", Number(e.target.value))} /></div>
              <div className="grid gap-2"><Label>Overtime at (hrs)</Label>
                <Input type="number" min={0} max={168} value={s.overtimeThreshold} onChange={(e) => set("overtimeThreshold", Number(e.target.value))} /></div>
            </div>

            <ToggleRow
              label="Allow self-service swaps"
              description="Let employees offer and claim shifts without manager pre-approval."
              checked={s.allowSelfSwap}
              onChange={(v) => set("allowSelfSwap", v)}
            />
            <ToggleRow
              label="Require GPS for clock-in"
              description="Staff must be within a location's geofence to clock in."
              checked={s.requireGpsClockIn}
              onChange={(v) => set("requireGpsClockIn", v)}
            />
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Max weekly hours and minimum rest drive the warning flags on the schedule. GPS enforcement uses each location's coordinates and radius.
      </p>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
