import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const PREFIX = "invite:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function inviteIdentifier(employeeId: string) {
  return `${PREFIX}${employeeId}`;
}

export function employeeIdFromIdentifier(identifier: string): string | null {
  return identifier.startsWith(PREFIX) ? identifier.slice(PREFIX.length) : null;
}

/** Create (or replace) an invite token for an employee. Returns the raw token. */
export async function createInviteToken(employeeId: string): Promise<string> {
  const identifier = inviteIdentifier(employeeId);
  const token = randomBytes(24).toString("hex");
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires: new Date(Date.now() + TTL_MS) },
  });
  return token;
}

export async function getValidInvite(token: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;
  if (record.expires < new Date()) return null;
  const employeeId = employeeIdFromIdentifier(record.identifier);
  if (!employeeId) return null;
  return { employeeId, identifier: record.identifier };
}

/** Map of employeeId -> true for employees with a live pending invite. */
export async function pendingInviteEmployeeIds(): Promise<Set<string>> {
  const tokens = await prisma.verificationToken.findMany({
    where: { identifier: { startsWith: PREFIX }, expires: { gt: new Date() } },
    select: { identifier: true },
  });
  const set = new Set<string>();
  for (const t of tokens) {
    const id = employeeIdFromIdentifier(t.identifier);
    if (id) set.add(id);
  }
  return set;
}
