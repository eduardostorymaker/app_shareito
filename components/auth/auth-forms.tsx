"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
  type AuthFormState,
} from "@/lib/actions/auth";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";

function FormError({ state }: { state: AuthFormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {state.error}
    </p>
  );
}

function PasswordInput({ id, autoComplete }: { id: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name="password" type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : undefined} className="h-11 pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  if (!GOOGLE_ENABLED) return null;
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="h-11 w-full">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          Continuar con Google
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> o con tu correo <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Inicia sesión</h1>
        <p className="text-sm text-muted-foreground">Tu sesión quedará abierta en este dispositivo.</p>
      </div>
      {notice ? <p className="rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p> : null}
      <GoogleButton next={next} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.email} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link href="/recuperar" className="text-xs font-medium text-primary">
              ¿La olvidaste?
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" />
        </div>
        <FormError state={state} />
        <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href={next !== "/" ? `/registro?next=${encodeURIComponent(next)}` : "/registro"} className="font-medium text-primary">
          Regístrate
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.message) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="text-xl font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">Gratis. Solo te pedimos lo justo.</p>
      </div>
      <GoogleButton next={next} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={60} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.email} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput id="password" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>
        <FormError state={state} />
        <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Recupera tu contraseña</h1>
        <p className="text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
      </div>
      {state?.message ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">{state.message}</p>
      ) : (
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.email} className="h-11" />
          </div>
          <FormError state={state} />
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">Elige una contraseña de al menos 8 caracteres.</p>
      </div>
      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña nueva</Label>
          <PasswordInput id="password" autoComplete="new-password" />
        </div>
        <FormError state={state} />
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
