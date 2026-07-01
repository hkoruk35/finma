export default function AccountLayout({ children }: { children: React.ReactNode }) {
  // /admin/account/login ve /admin/account/register sayfaları public
  // Auth kontrolü proxy.ts'de yapılıyor
  return <>{children}</>;
}
