import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isAdminAuthed } from "@/lib/auth";
import AdminNav from "./components/adminnav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!isAdminAuthed()) {
    redirect("/login");
  }

  return (
    <div>
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}