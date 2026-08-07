import { cookies } from "next/headers";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const role = cookieStore.get("boga_auth")?.value;

  // Auth check proxy.ts'de yapılıyor

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col md:flex-row">
      <AdminSidebar role={role} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
