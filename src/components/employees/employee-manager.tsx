"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, UserPlus, Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrency, initials, cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Employee = {
  id: string; firstName: string; lastName: string; email: string; phone: string | null;
  jobTitle: string | null; employmentType: string; hourlyRate: number; contractedHours: number;
  departmentId: string | null; departmentName: string | null; startDate: string | null;
  hasLogin: boolean; invited: boolean; skillIds: string[]; holidayAllowance: number;
};
type Dept = { id: string; name: string };
type Skill = { id: string; name: string };

const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "CASUAL", label: "Casual" },
];

function emptyForm() {
  return {
    firstName: "", lastName: "", email: "", phone: "", jobTitle: "",
    employmentType: "FULL_TIME", hourlyRate: "0", contractedHours: "40", holidayAllowance: "28",
    departmentId: "", startDate: "", skillIds: [] as string[],
  };
}

export function EmployeeManager({ employees, departments, skills }: { employees: Employee[]; departments: Dept[]; skills: Skill[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(emptyForm());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newSkill, setNewSkill] = React.useState("");

  const [inviteBusyId, setInviteBusyId] = React.useState<string | null>(null);
  const [inviteLink, setInviteLink] = React.useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(e: Employee) {
    setEditId(e.id);
    setForm({
      firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone ?? "",
      jobTitle: e.jobTitle ?? "", employmentType: e.employmentType,
      hourlyRate: String(e.hourlyRate), contractedHours: String(e.contractedHours),
      holidayAllowance: String(e.holidayAllowance),
      departmentId: e.departmentId ?? "", startDate: e.startDate ?? "", skillIds: e.skillIds,
    });
    setNewSkill("");
    setError(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone || undefined,
      jobTitle: form.jobTitle || undefined,
      employmentType: form.employmentType,
      hourlyRate: Number(form.hourlyRate) || 0,
      contractedHours: Number(form.contractedHours) || 0,
      holidayAllowance: Number(form.holidayAllowance) || 0,
      departmentId: form.departmentId || null,
      startDate: form.startDate || undefined,
      skillIds: form.skillIds,
    };
    try {
      const res = await fetch(editId ? `/api/employees/${editId}` : "/api/employees", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save employee");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function addSkill() {
    const name = newSkill.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not add skill");
      if (data.skill?.id) {
        setForm((f) => ({ ...f, skillIds: f.skillIds.includes(data.skill.id) ? f.skillIds : [...f.skillIds, data.skill.id] }));
      }
      setNewSkill("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!editId) return;
    if (!confirm("Deactivate this employee? Their past shifts and timesheets are kept.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/employees/${editId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not deactivate");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function invite(e: Employee) {
    setInviteBusyId(e.id);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${e.id}/invite`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create invite");
      const url = `${window.location.origin}/invite/${data.token}`;
      setCopied(false);
      setInviteLink({ name: `${e.firstName} ${e.lastName}`, url });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setInviteBusyId(null);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked; user can select manually */
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${employees.length} active team ${employees.length === 1 ? "member" : "members"}`}
        action={<Button onClick={openCreate}><Plus /> Add employee</Button>}
      />

      {error && !open && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Job title</th>
              <th className="p-3 font-medium">Department</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Rate</th>
              <th className="p-3 font-medium">Login</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No employees yet. Add your first team member.</td></tr>
            ) : employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {initials(`${e.firstName} ${e.lastName}`)}
                    </div>
                    <div>
                      <div className="font-medium">{e.firstName} {e.lastName}</div>
                      <div className="text-xs text-muted-foreground">{e.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{e.jobTitle ?? "—"}</td>
                <td className="p-3">{e.departmentName ?? "—"}</td>
                <td className="p-3"><Badge variant="secondary">{e.employmentType.replace("_", " ").toLowerCase()}</Badge></td>
                <td className="p-3 tabular-nums">{formatCurrency(e.hourlyRate)}/hr</td>
                <td className="p-3">
                  {e.hasLogin ? (
                    <Badge variant="success"><KeyRound className="mr-1 size-3" /> Active</Badge>
                  ) : (
                    <Button variant={e.invited ? "ghost" : "outline"} size="sm" onClick={() => invite(e)} disabled={inviteBusyId === e.id}>
                      {inviteBusyId === e.id ? <Loader2 className="animate-spin" /> : <UserPlus className="size-4" />}
                      {e.invited ? "Resend" : "Invite"}
                    </Button>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>{editId ? "Update this team member's details." : "Add a new team member to your roster."}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>First name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Last name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Job title</Label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Department</Label>
                <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>Type</Label>
                <Select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select></div>
              <div className="grid gap-2"><Label>Rate (£/hr)</Label>
                <Input type="number" min={0} step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Contract (h/wk)</Label>
                <Input type="number" min={0} max={168} value={form.contractedHours} onChange={(e) => setForm({ ...form, contractedHours: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Holiday allowance (days/yr)</Label>
                <Input type="number" min={0} max={366} value={form.holidayAllowance} onChange={(e) => setForm({ ...form, holidayAllowance: e.target.value })} /></div>
            </div>

            <div className="grid gap-2">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2">
                {skills.length === 0 && <span className="text-xs text-muted-foreground">No skills yet — add one below.</span>}
                {skills.map((sk) => {
                  const on = form.skillIds.includes(sk.id);
                  return (
                    <button key={sk.id} type="button"
                      onClick={() => setForm((f) => ({ ...f, skillIds: on ? f.skillIds.filter((x) => x !== sk.id) : [...f.skillIds, sk.id] }))}
                      className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
                        on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>
                      {sk.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a new skill (e.g. Forklift)"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
                <Button type="button" variant="outline" onClick={addSkill} disabled={busy || !newSkill.trim()}>Add</Button>
              </div>
            </div>

            {error && open && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="sm:justify-between">
            {editId ? (
              <Button variant="outline" className="text-destructive" onClick={deactivate} disabled={busy}>Deactivate</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} {editId ? "Save" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite link dialog */}
      <Dialog open={!!inviteLink} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite link ready</DialogTitle>
            <DialogDescription>
              Share this link with {inviteLink?.name}. They'll set a password and get an employee login. The link expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteLink?.url ?? ""} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
            <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
