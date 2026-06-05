"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type SwapStatus = "OPEN" | "CLAIMED" | "APPROVED" | "REJECTED" | "CANCELLED";
const STATUS_VARIANT: Record<SwapStatus, "warning" | "success" | "destructive" | "secondary" | "default"> = {
  OPEN: "default", CLAIMED: "warning", APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary",
};

interface Props {
  isManager: boolean;
  hasEmployee: boolean;
  offerable: { id: string; label: string }[];
  openPool: { id: string; requesterName: string; label: string; reason: string | null }[];
  mySwaps: { id: string; status: SwapStatus; label: string; claimerName: string | null }[];
  approvalQueue: { id: string; requesterName: string; claimerName: string; label: string }[];
}

export function SwapManager(props: Props) {
  const router = useRouter();
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [shiftId, setShiftId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown, busyKey?: string) {
    setBusyId(busyKey ?? url);
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
      setBusyId(null);
    }
  }

  async function offer() {
    if (!shiftId) { setError("Pick a shift to offer."); return; }
    const ok = await call("/api/swaps", "POST", { shiftId, reason: reason || undefined }, "offer");
    if (ok) { setOfferOpen(false); setShiftId(""); setReason(""); }
  }

  return (
    <div>
      <PageHeader
        title="Shift swaps"
        description="Offer shifts you can't make, claim open ones, and let a manager approve the swap."
        action={props.hasEmployee ? <Button onClick={() => setOfferOpen(true)}><Plus /> Offer a shift</Button> : undefined}
      />

      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open pool */}
        <Card>
          <CardHeader><CardTitle className="text-base">Open shifts to claim</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {props.openPool.length === 0 ? (
              <Empty>No open shifts right now.</Empty>
            ) : props.openPool.map((s) => (
              <Row key={s.id} title={s.label} subtitle={`Offered by ${s.requesterName}${s.reason ? ` · ${s.reason}` : ""}`}>
                {props.hasEmployee && (
                  <Button size="sm" onClick={() => call(`/api/swaps/${s.id}/claim`, "POST", undefined, s.id)} disabled={busyId === s.id}>
                    {busyId === s.id ? <Loader2 className="animate-spin" /> : null} Claim
                  </Button>
                )}
              </Row>
            ))}
          </CardContent>
        </Card>

        {/* My requests */}
        <Card>
          <CardHeader><CardTitle className="text-base">My swap requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {props.mySwaps.length === 0 ? (
              <Empty>You haven't offered any shifts.</Empty>
            ) : props.mySwaps.map((s) => (
              <Row key={s.id} title={s.label}
                subtitle={s.claimerName ? `Claimed by ${s.claimerName}` : "Waiting for someone to claim"}>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[s.status]}>{s.status.toLowerCase()}</Badge>
                  {(s.status === "OPEN" || s.status === "CLAIMED") && (
                    <Button size="sm" variant="ghost" onClick={() => call(`/api/swaps/${s.id}`, "DELETE", undefined, s.id)} disabled={busyId === s.id}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Row>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Approval queue (managers) */}
      {props.isManager && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Awaiting your approval</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {props.approvalQueue.length === 0 ? (
              <Empty>Nothing to approve.</Empty>
            ) : props.approvalQueue.map((s) => (
              <Row key={s.id} title={s.label} subtitle={`${s.requesterName} → ${s.claimerName}`}>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => call(`/api/swaps/${s.id}`, "PATCH", { action: "REJECT" }, s.id)} disabled={busyId === s.id}>Reject</Button>
                  <Button size="sm" onClick={() => call(`/api/swaps/${s.id}`, "PATCH", { action: "APPROVE" }, s.id)} disabled={busyId === s.id}>
                    {busyId === s.id ? <Loader2 className="animate-spin" /> : null} Approve
                  </Button>
                </div>
              </Row>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Offer dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offer a shift for swap</DialogTitle>
            <DialogDescription>Pick one of your upcoming shifts to put up for swap.</DialogDescription>
          </DialogHeader>

          {props.offerable.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You have no upcoming published shifts available to offer.
            </p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Shift</Label>
                <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                  <option value="">Select a shift…</option>
                  {props.offerable.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Let colleagues know why" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOfferOpen(false)} disabled={busyId === "offer"}>Cancel</Button>
            <Button onClick={offer} disabled={busyId === "offer" || props.offerable.length === 0}>
              {busyId === "offer" ? <Loader2 className="animate-spin" /> : null} Offer shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <ArrowLeftRight className="size-5" /> {children}
    </div>
  );
}
