import { redirect } from "next/navigation";

import { getSession, pathForRole } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  redirect(pathForRole(session.role));
}
