"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, Send, AlertTriangle, Loader2, Trash2, Repeat } from "lucide-react";
import { addDays, getWeekStart, shiftHours, DAY_LABELS } from "@/lib/scheduling";
import { cn, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type EmployeeLite = { id: string; name: string; jobTitle: string; departmentId: string | null; contractedHours: number };
type DepartmentLite = { id: string; name: string; color: string };
type ShiftLite = {
  id: string; employeeId: string | null; departmentId: string | null;
  start: string; end: string; breakMinutes: number; status: string; notes: string | null;
  recurrenceId: string | null; requiredSkillIds: string[];
};
type SkillLite = { id: string; name: string };
type WarningLite = { severity: string; message: string };

interface Props {
  weekStartIso: string;
  locationId: string;
  locationName: string;
  canEdit: boolean;
  status: string;
  employees: EmployeeLite[];
  departments: DepartmentLite[];
  shifts: ShiftLite[];
  skills: SkillLite[];
  warnings: Record<string, WarningLite[]>;
}

interface DraftState {
  id: string | null;          // null => create
  employeeId: string | null;
  departmentId: string | null;
  dayIdx: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes: string;
  repeatWeeks: number;        // create only: repeat for N more weeks
  recurrenceId: string | null; // edit only: part of a series
  skillIds: string[];          // required skills for the shift
}

function toISO(weekStart: Date, dayIdx: number, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = addDays(weekStart, dayIdx);
  d.setHours(h, m || 0, 0, 0);
  return d.toISOString();
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function RotaEditor(props: Props) {
  const router = useRouter();
  const weekStart = React.useMemo(() => new Date(props.weekStartIso), [props.weekStartIso]);

  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);

  // index shifts by employeeId|"open" + dayIdx
  const grid = React.useMemo(() => {
    const map = new Map<string, ShiftLite[]>();
    for (const s of props.shifts) {
      const d = new Date(s.start);
      const idx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
        new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime()) / 86_400_000);
      const key = `${s.employeeId ?? "open"}:${idx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [props.shifts, weekStart]);

  const weeklyHours = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of props.shifts) {
      if (!s.employeeId) continue;
      m.set(s.employeeId, (m.get(s.employeeId) ?? 0) + shiftHours(s.start, s.end, s.breakMinutes));
    }
    return m;
  }, [props.shifts]);

  function goWeek(deltaDays: number) {
    const target = getWeekStart(addDays(weekStart, deltaDays));
    router.push(`/schedule?week=${target.toISOString().slice(0, 10)}`);
  }

  function openCreate(employeeId: string | null, dayIdx: number) {
    if (!props.canEdit) return;
    const emp = props.employees.find((e) => e.id === employeeId);
    setError(null);
    setDraft({
      id: null,
      employeeId,
      departmentId: emp?.departmentId ?? props.departments[0]?.id ?? null,
      dayIdx,
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      notes: "",
      repeatWeeks: 0,
      recurrenceId: null,
      skillIds: [],
    });
  }

  function openEdit(s: ShiftLite) {
    if (!props.canEdit) return;
    const d = new Date(s.start);
    const idx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime()) / 86_400_000);
    setError(null);
    setDraft({
      id: s.id,
      employeeId: s.employeeId,
      departmentId: s.departmentId,
      dayIdx: idx,
      startTime: timeOf(s.start),
      endTime: timeOf(s.end),
      breakMinutes: s.breakMinutes,
      notes: s.notes ?? "",
      repeatWeeks: 0,
      recurrenceId: s.recurrenceId,
      skillIds: s.requiredSkillIds,
    });
  }

  // Drag a shift onto another cell: move it to that day and/or employee.
  async function moveShift(shiftId: string, targetEmployeeId: string | null, targetDayIdx: number) {
    const s = props.shifts.find((x) => x.id === shiftId);
    if (!s) return;
    const sourceDay = Math.floor((new Date(new Date(s.start).getFullYear(), new Date(s.start).getMonth(), new Date(s.start).getDate()).getTime() -
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime()) / 86_400_000);
    if (s.employeeId === targetEmployeeId && sourceDay === targetDayIdx) return; // no-op

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: targetEmployeeId,
          start: toISO(weekStart, targetDayIdx, timeOf(s.start)),
          end: toISO(weekStart, targetDayIdx, timeOf(s.end)),
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Could not move shift"); }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const start = toISO(weekStart, draft.dayIdx, draft.startTime);
    const end = toISO(weekStart, draft.dayIdx, draft.endTime);

    try {
      let res: Response;
      if (draft.id) {
        res = await fetch(`/api/shifts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: draft.employeeId, departmentId: draft.departmentId,
            start, end, breakMinutes: draft.breakMinutes, notes: draft.notes || null,
            skillIds: draft.skillIds,
          }),
        });
      } else {
        res = await fetch(`/api/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart: weekStart.toISOString(), locationId: props.locationId,
            employeeId: draft.employeeId, departmentId: draft.departmentId,
            start, end, breakMinutes: draft.breakMinutes, notes: draft.notes || undefined,
            repeatWeeks: draft.repeatWeeks || 0, skillIds: draft.skillIds,
          }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save shift");
      }
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(series = false) {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/shifts/${draft.id}${series ? "?series=true" : ""}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function copyLastWeek() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const source = getWeekStart(addDays(weekStart, -7));
      const res = await fetch(`/api/schedule/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: props.locationId,
          sourceWeekStart: source.toISOString(),
          targetWeekStart: weekStart.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not copy week");
      setNotice(`Copied ${data.copied} shifts from last week.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/schedule/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: props.locationId, weekStart: weekStart.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not publish");
      setNotice(`Published ${data.published} shifts.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const dept = (id: string | null) => props.departments.find((d) => d.id === id);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">{props.locationName} · {weekLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border">
            <Button variant="ghost" size="icon" onClick={() => goWeek(-7)} aria-label="Previous week"><ChevronLeft /></Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/schedule")} className="px-3">Today</Button>
            <Button variant="ghost" size="icon" onClick={() => goWeek(7)} aria-label="Next week"><ChevronRight /></Button>
          </div>
          <Badge variant={props.status === "PUBLISHED" ? "success" : "secondary"}>
            {props.status === "PUBLISHED" ? "Published" : "Draft"}
          </Badge>
          {props.canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={copyLastWeek} disabled={busy}><Copy /> Copy last week</Button>
              <Button size="sm" onClick={publish} disabled={busy}><Send /> Publish</Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 z-10 w-52 bg-card p-3 text-left font-medium">Employee</th>
              {DAY_LABELS.map((d, i) => {
                const date = addDays(weekStart, i);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <th key={d} className={cn("p-2 text-center font-medium", isToday && "text-primary")}>
                    <div>{d}</div>
                    <div className="text-xs font-normal text-muted-foreground">{date.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Open / unassigned shifts */}
            <tr className="border-b bg-muted/30">
              <td className="sticky left-0 z-10 bg-muted/30 p-3 font-medium text-muted-foreground">Open shifts</td>
              {DAY_LABELS.map((_, dayIdx) => (
                <Cell
                  key={dayIdx}
                  cellKey={`open:${dayIdx}`}
                  rowEmployeeId={null}
                  dayIdx={dayIdx}
                  shifts={grid.get(`open:${dayIdx}`) ?? []}
                  dept={dept}
                  canEdit={props.canEdit}
                  onAdd={() => openCreate(null, dayIdx)}
                  onEdit={openEdit}
                  dragId={dragId}
                  dragOverKey={dragOverKey}
                  onShiftDragStart={setDragId}
                  onShiftDragEnd={() => { setDragId(null); setDragOverKey(null); }}
                  onCellDragOver={setDragOverKey}
                  onCellDrop={(empId, day) => { if (dragId) moveShift(dragId, empId, day); setDragId(null); setDragOverKey(null); }}
                  open
                />
              ))}
            </tr>

            {props.employees.map((emp) => {
              const total = weeklyHours.get(emp.id) ?? 0;
              const empWarnings = props.warnings[emp.id] ?? [];
              return (
                <tr key={emp.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card p-3">
                    <div className="font-medium">{emp.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{emp.jobTitle}</span>
                      <span>·</span>
                      <span className="tabular-nums">{total.toFixed(1)}h</span>
                      {empWarnings.length > 0 && (
                        <span className="group relative inline-flex">
                          <AlertTriangle className={cn("size-3.5", empWarnings.some((w) => w.severity === "error") ? "text-destructive" : "text-amber-500")} />
                          <span className="invisible absolute left-0 top-5 z-20 w-56 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:visible">
                            {empWarnings.map((w, i) => <div key={i}>{w.message}</div>)}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  {DAY_LABELS.map((_, dayIdx) => (
                    <Cell
                      key={dayIdx}
                      cellKey={`${emp.id}:${dayIdx}`}
                      rowEmployeeId={emp.id}
                      dayIdx={dayIdx}
                      shifts={grid.get(`${emp.id}:${dayIdx}`) ?? []}
                      dept={dept}
                      canEdit={props.canEdit}
                      onAdd={() => openCreate(emp.id, dayIdx)}
                      onEdit={openEdit}
                      dragId={dragId}
                      dragOverKey={dragOverKey}
                      onShiftDragStart={setDragId}
                      onShiftDragEnd={() => { setDragId(null); setDragOverKey(null); }}
                      onCellDragOver={setDragOverKey}
                      onCellDrop={(empId, day) => { if (dragId) moveShift(dragId, empId, day); setDragId(null); setDragOverKey(null); }}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        {props.canEdit ? "Click a cell to add a shift, click a shift to edit it, or drag a shift to another day or employee to move it. Warnings flag overtime, short rest, and availability conflicts." : "You have read-only access to the schedule."}
      </p>

      {/* Shift dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit shift" : "Add shift"}</DialogTitle>
            <DialogDescription>
              {draft && `${DAY_LABELS[draft.dayIdx]} ${addDays(weekStart, draft.dayIdx).toLocaleDateString("en-GB")}`}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Employee</Label>
                <Select value={draft.employeeId ?? ""} onChange={(e) => setDraft({ ...draft, employeeId: e.target.value || null })}>
                  <option value="">Open shift (unassigned)</option>
                  {props.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Day</Label>
                  <Select value={draft.dayIdx} onChange={(e) => setDraft({ ...draft, dayIdx: Number(e.target.value) })}>
                    {DAY_LABELS.map((d, i) => <option key={d} value={i}>{d} {addDays(weekStart, i).getDate()}</option>)}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Department</Label>
                  <Select value={draft.departmentId ?? ""} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value || null })}>
                    <option value="">None</option>
                    {props.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Start</Label>
                  <Input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>End</Label>
                  <Input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Break (min)</Label>
                  <Input type="number" min={0} max={480} value={draft.breakMinutes}
                    onChange={(e) => setDraft({ ...draft, breakMinutes: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Optional" />
              </div>

              {/* Required skills */}
              {props.skills.length > 0 && (
                <div className="grid gap-2">
                  <Label>Required skills</Label>
                  <div className="flex flex-wrap gap-2">
                    {props.skills.map((sk) => {
                      const on = draft.skillIds.includes(sk.id);
                      return (
                        <button
                          key={sk.id}
                          type="button"
                          onClick={() => setDraft({
                            ...draft,
                            skillIds: on ? draft.skillIds.filter((x) => x !== sk.id) : [...draft.skillIds, sk.id],
                          })}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {sk.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">The assigned employee will be flagged if they lack any selected skill.</p>
                </div>
              )}

              {/* Repeat — only when creating a new shift */}
              {!draft.id && (
                <div className="grid gap-2 rounded-lg border p-3">
                  <Label className="flex items-center gap-2"><Repeat className="size-4" /> Repeat weekly</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">for</span>
                    <Input type="number" min={0} max={52} value={draft.repeatWeeks} className="w-20"
                      onChange={(e) => setDraft({ ...draft, repeatWeeks: Math.max(0, Number(e.target.value)) })} />
                    <span className="text-muted-foreground">more {draft.repeatWeeks === 1 ? "week" : "weeks"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draft.repeatWeeks > 0
                      ? `Creates ${draft.repeatWeeks + 1} shifts on the same day & time across ${draft.repeatWeeks + 1} weeks.`
                      : "Leave at 0 for a one-off shift."}
                  </p>
                </div>
              )}

              {/* Series indicator — when editing a recurring shift */}
              {draft.id && draft.recurrenceId && (
                <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Repeat className="size-3.5" /> Part of a weekly series. Edits here apply to this shift only.
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            {draft?.id ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => remove(false)} disabled={busy} className="text-destructive">
                  <Trash2 /> Delete
                </Button>
                {draft.recurrenceId && (
                  <Button variant="ghost" onClick={() => remove(true)} disabled={busy} className="text-destructive">
                    Delete series
                  </Button>
                )}
              </div>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {draft?.id ? "Save" : "Add shift"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Cell({
  shifts, dept, canEdit, onAdd, onEdit, open,
  cellKey, rowEmployeeId, dayIdx, dragId, dragOverKey,
  onShiftDragStart, onShiftDragEnd, onCellDragOver, onCellDrop,
}: {
  shifts: ShiftLite[];
  dept: (id: string | null) => DepartmentLite | undefined;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (s: ShiftLite) => void;
  open?: boolean;
  cellKey: string;
  rowEmployeeId: string | null;
  dayIdx: number;
  dragId: string | null;
  dragOverKey: string | null;
  onShiftDragStart: (id: string) => void;
  onShiftDragEnd: () => void;
  onCellDragOver: (key: string) => void;
  onCellDrop: (rowEmployeeId: string | null, dayIdx: number) => void;
}) {
  const isTarget = canEdit && !!dragId && dragOverKey === cellKey;
  return (
    <td
      className={cn("group h-16 p-1.5 align-top transition-colors", open && "bg-muted/30", isTarget && "bg-primary/10 ring-2 ring-inset ring-primary/40")}
      onDragOver={canEdit && dragId ? (e) => { e.preventDefault(); onCellDragOver(cellKey); } : undefined}
      onDrop={canEdit && dragId ? (e) => { e.preventDefault(); onCellDrop(rowEmployeeId, dayIdx); } : undefined}
    >
      {shifts.map((s) => {
        const d = dept(s.departmentId);
        return (
          <button
            key={s.id}
            draggable={canEdit}
            onDragStart={canEdit ? (e) => { e.dataTransfer.effectAllowed = "move"; onShiftDragStart(s.id); } : undefined}
            onDragEnd={canEdit ? onShiftDragEnd : undefined}
            onClick={() => onEdit(s)}
            disabled={!canEdit}
            className={cn(
              "mb-1 block w-full rounded-md border-l-2 bg-background px-2 py-1 text-left text-xs shadow-sm transition-colors hover:bg-accent disabled:cursor-default",
              canEdit && "cursor-grab active:cursor-grabbing",
              dragId === s.id && "opacity-40"
            )}
            style={{ borderColor: d?.color ?? "#6366f1" }}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-medium tabular-nums">{formatTime(s.start)}–{formatTime(s.end)}</span>
              {s.recurrenceId && <Repeat className="size-3 shrink-0 text-muted-foreground" />}
            </div>
            <div className="truncate text-muted-foreground">{d?.name ?? (open ? "Unfilled" : "—")}</div>
          </button>
        );
      })}
      {canEdit && !dragId && (
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center rounded-md py-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          aria-label="Add shift"
        >
          <Plus className="size-4" />
        </button>
      )}
    </td>
  );
}
