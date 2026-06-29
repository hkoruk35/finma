import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function CSPLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const role = cookieStore.get("boga_auth")?.value;
  if (role !== "admin" && role !== "readonly") {
    redirect("/login");
  }

  return children;
}
