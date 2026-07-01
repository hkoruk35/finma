import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const role = cookieStore.get("boga_auth")?.value;
  if (role !== "admin" && role !== "readonly") {
    redirect("/admin/account/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] flex">
      <AdminSidebar role={role} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
