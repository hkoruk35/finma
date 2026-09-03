import { cookies } from "next/headers";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const role = cookieStore.get("boga_auth")?.value;

  // Sayfa erişimi (redirect) proxy.ts'de yapılıyor, ama login/register
  // sayfaları BİLEREK auth-muaf tutuluyor ki oraya ulaşılabilsin — bu
  // yüzden role burada da kontrol edilmeli. Aksi halde giriş yapmamış biri
  // /admin/account/login'i açtığında sidebar (tüm menü başlıkları) role
  // olmadan da render ediliyordu; menü listesi kimliği doğrulanmamışa
  // sızmasın diye role yoksa sidebar hiç gösterilmez.
  if (!role) {
    return <div className="min-h-screen bg-[#0a0e17]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col md:flex-row">
      <AdminSidebar role={role} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
