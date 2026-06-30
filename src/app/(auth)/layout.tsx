import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/sessions");
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}
