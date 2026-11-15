import { AuthShell } from "@/components/layout/auth-shell";
import { NewPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Nueva contraseña" };

export default function UpdatePasswordPage() {
  return (
    <AuthShell>
      <NewPasswordForm />
    </AuthShell>
  );
}
