import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/login-screen";
import { getSession, pathForRole } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect(pathForRole(session.role));
  }

  return <LoginScreen />;
}
