import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getStaffRole } from "@/lib/auth";
import AdminNav from "../components/adminnav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const role = getStaffRole();
  if (!role) {
    redirect("/login");
  }

  return (
    <div>
      <AdminNav role={role} />
      <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}