import { describe, it, expect } from "vitest";
import { can, hasAtLeast, isManagerOrAbove } from "@/lib/permissions";

describe("RBAC capabilities", () => {
  it("employees cannot publish schedules or write org structure", () => {
    expect(can("EMPLOYEE", "schedule:publish")).toBe(false);
    expect(can("EMPLOYEE", "org:write")).toBe(false);
    expect(can("EMPLOYEE", "employee:write")).toBe(false);
  });

  it("employees can do their own self-service actions", () => {
    expect(can("EMPLOYEE", "schedule:read")).toBe(true);
    expect(can("EMPLOYEE", "leave:request")).toBe(true);
    expect(can("EMPLOYEE", "swap:request")).toBe(true);
    expect(can("EMPLOYEE", "timesheet:clock")).toBe(true);
  });

  it("managers can run scheduling, approvals and org structure", () => {
    expect(can("MANAGER", "schedule:publish")).toBe(true);
    expect(can("MANAGER", "leave:approve")).toBe(true);
    expect(can("MANAGER", "swap:approve")).toBe(true);
    expect(can("MANAGER", "org:write")).toBe(true);
    expect(can("MANAGER", "timesheet:approve")).toBe(true);
  });

  it("only owners and above can change settings", () => {
    expect(can("MANAGER", "settings:write")).toBe(false);
    expect(can("BUSINESS_OWNER", "settings:write")).toBe(true);
    expect(can("SUPER_ADMIN", "settings:write")).toBe(true);
  });

  it("only super admins can manage tenants", () => {
    expect(can("BUSINESS_OWNER", "tenant:manage")).toBe(false);
    expect(can("SUPER_ADMIN", "tenant:manage")).toBe(true);
  });

  it("role ranking is ordered correctly", () => {
    expect(hasAtLeast("BUSINESS_OWNER", "MANAGER")).toBe(true);
    expect(hasAtLeast("EMPLOYEE", "MANAGER")).toBe(false);
    expect(isManagerOrAbove("MANAGER")).toBe(true);
    expect(isManagerOrAbove("EMPLOYEE")).toBe(false);
  });
});
