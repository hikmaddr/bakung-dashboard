import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import ClientAdminLayout from "./ClientAdminLayout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth?.userId) {
    const redirectParam = "/";
    redirect(`/signin?redirect=${encodeURIComponent(redirectParam)}`);
  }
  return <ClientAdminLayout>{children}</ClientAdminLayout>;
}
