"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Department = { id: string; name: string; color: string; employeeCount: number };
type Location = {
  id: string; name: string; address: string | null;
  latitude: number | null; longitude: number | null; radius: number; departments: Department[];
};

export function LocationManager({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [locDialog, setLocDialog] = React.useState<null | { id: string | null; name: string; address: string; latitude: string; longitude: string; radius: string }>(null);
  const [depDialog, setDepDialog] = React.useState<null | { id: string | null; locationId: string; name: string; color: string }>(null);

  async function req(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveLocation() {
    if (!locDialog) return;
    const payload = {
      name: locDialog.name.trim(),
      address: locDialog.address || undefined,
      latitude: locDialog.latitude ? Number(locDialog.latitude) : null,
      longitude: locDialog.longitude ? Number(locDialog.longitude) : null,
      radius: Number(locDialog.radius) || 150,
    };
    const ok = await req(locDialog.id ? `/api/locations/${locDialog.id}` : "/api/locations", locDialog.id ? "PATCH" : "POST", payload);
    if (ok) setLocDialog(null);
  }

  async function saveDepartment() {
    if (!depDialog) return;
    const ok = depDialog.id
      ? await req(`/api/departments/${depDialog.id}`, "PATCH", { name: depDialog.name.trim(), color: depDialog.color })
      : await req(`/api/departments`, "POST", { locationId: depDialog.locationId, name: depDialog.name.trim(), color: depDialog.color });
    if (ok) setDepDialog(null);
  }

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Manage your sites and the departments within them."
        action={<Button onClick={() => setLocDialog({ id: null, name: "", address: "", latitude: "", longitude: "", radius: "150" })}><Plus /> Add location</Button>}
      />

      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {locations.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
          <MapPin className="size-6" /> No locations yet. Add your first site.
        </Card>
      ) : (
        <div className="space-y-4">
          {locations.map((loc) => (
            <Card key={loc.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2 font-semibold">{loc.name}</div>
                  <div className="text-sm text-muted-foreground">{loc.address ?? "No address"}</div>
                  {loc.latitude != null && loc.longitude != null && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} · {loc.radius}m geofence
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setLocDialog({
                    id: loc.id, name: loc.name, address: loc.address ?? "",
                    latitude: loc.latitude?.toString() ?? "", longitude: loc.longitude?.toString() ?? "",
                    radius: loc.radius.toString(),
                  })}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive"
                    onClick={() => { if (confirm(`Delete location "${loc.name}"?`)) req(`/api/locations/${loc.id}`, "DELETE"); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {loc.departments.map((d) => (
                    <button key={d.id}
                      onClick={() => setDepDialog({ id: d.id, locationId: loc.id, name: d.name, color: d.color })}
                      className="group flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-accent">
                      <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name}
                      <span className="text-xs text-muted-foreground">· {d.employeeCount}</span>
                      <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
                    </button>
                  ))}
                  <Button variant="outline" size="sm"
                    onClick={() => setDepDialog({ id: null, locationId: loc.id, name: "", color: "#6366f1" })}>
                    <Plus className="size-4" /> Department
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Location dialog */}
      <Dialog open={!!locDialog} onOpenChange={(o) => !o && setLocDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locDialog?.id ? "Edit location" : "Add location"}</DialogTitle>
            <DialogDescription>Coordinates and radius are used for GPS clock-in.</DialogDescription>
          </DialogHeader>
          {locDialog && (
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Name</Label>
                <Input value={locDialog.name} onChange={(e) => setLocDialog({ ...locDialog, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Address</Label>
                <Input value={locDialog.address} onChange={(e) => setLocDialog({ ...locDialog, address: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2"><Label>Latitude</Label>
                  <Input value={locDialog.latitude} onChange={(e) => setLocDialog({ ...locDialog, latitude: e.target.value })} placeholder="53.7997" /></div>
                <div className="grid gap-2"><Label>Longitude</Label>
                  <Input value={locDialog.longitude} onChange={(e) => setLocDialog({ ...locDialog, longitude: e.target.value })} placeholder="-1.5492" /></div>
                <div className="grid gap-2"><Label>Radius (m)</Label>
                  <Input type="number" value={locDialog.radius} onChange={(e) => setLocDialog({ ...locDialog, radius: e.target.value })} /></div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLocDialog(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveLocation} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department dialog */}
      <Dialog open={!!depDialog} onOpenChange={(o) => !o && setDepDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{depDialog?.id ? "Edit department" : "Add department"}</DialogTitle>
          </DialogHeader>
          {depDialog && (
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Name</Label>
                <Input value={depDialog.name} onChange={(e) => setDepDialog({ ...depDialog, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Colour</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={depDialog.color} onChange={(e) => setDepDialog({ ...depDialog, color: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-md border bg-background" />
                  <span className="text-sm text-muted-foreground">{depDialog.color}</span>
                </div></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            {depDialog?.id ? (
              <Button variant="outline" className="text-destructive"
                onClick={async () => { if (confirm("Delete this department?")) { const ok = await req(`/api/departments/${depDialog.id}`, "DELETE"); if (ok) setDepDialog(null); } }}
                disabled={busy}>Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDepDialog(null)} disabled={busy}>Cancel</Button>
              <Button onClick={saveDepartment} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
