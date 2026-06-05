import { describe, it, expect } from "vitest";
import { inviteIdentifier, employeeIdFromIdentifier } from "@/lib/invite";

describe("invite identifier helpers", () => {
  it("round-trips an employee id", () => {
    expect(employeeIdFromIdentifier(inviteIdentifier("emp_123"))).toBe("emp_123");
  });
  it("returns null for non-invite identifiers", () => {
    expect(employeeIdFromIdentifier("verify:foo")).toBeNull();
  });
});
