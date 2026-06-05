import { LayoutDashboard, CalendarDays, Users, MapPin, Plane, ArrowLeftRight, Clock, BarChart3, Settings } from "lucide-react";
import type { Role } from "@prisma/client";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  minRole?: Role;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Employees", href: "/employees", icon: Users, minRole: "MANAGER" },
  { label: "Locations", href: "/locations", icon: MapPin, minRole: "MANAGER" },
  { label: "Leave", href: "/leave", icon: Plane },
  { label: "Shift swaps", href: "/swaps", icon: ArrowLeftRight },
  { label: "Timesheets", href: "/timesheets", icon: Clock },
  { label: "Reports", href: "/reports", icon: BarChart3, minRole: "MANAGER" },
  { label: "Settings", href: "/settings", icon: Settings, minRole: "BUSINESS_OWNER" },
];
