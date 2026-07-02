import { cookies } from "next/headers";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const role = cookieStore.get("boga_auth")?.value;

  // Auth check proxy.ts'de yapılıyor

  return (
    <div className="min-h-screen bg-[#000036] flex">
      <AdminSidebar role={role} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
