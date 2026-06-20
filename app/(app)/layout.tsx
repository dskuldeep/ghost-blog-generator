import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{
          name: session.user.name ?? undefined,
          email: session.user.email ?? undefined,
        }}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
