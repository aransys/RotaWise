import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getValidInvite } from "@/lib/invite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getValidInvite(token);
  const employee = invite ? await prisma.employee.findUnique({ where: { id: invite.employeeId }, include: { tenant: true } }) : null;
  const valid = !!invite && !!employee && !employee.userId;

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        {valid && employee ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Join {employee.tenant.name}</CardTitle>
              <CardDescription>
                Set a password to activate the login for <span className="font-medium text-foreground">{employee.email}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AcceptInviteForm
                token={token}
                email={employee.email}
                defaultName={`${employee.firstName} ${employee.lastName}`}
              />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Invite unavailable</CardTitle>
              <CardDescription>This invite link is invalid, has expired, or has already been used.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">Go to sign in</Link>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
