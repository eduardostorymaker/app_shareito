import { cn } from "@/lib/utils";

/**
 * Símbolo de Shareito: billetera de línea con el broche en rosa.
 * Diseño de origen: brand/logo-c/c1-indigo-rosa*.svg (viewBox 48).
 * El trazo usa currentColor; `small` engrosa el trazo para tamaños de 32 px o menos.
 */
export function ShareitoMark({ className, small = false, title }: { className?: string; small?: boolean; title?: string }) {
  const sw = small ? 3.2 : 2.6;
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 13.5 31 8.3a2.6 2.6 0 0 1 3.3 2.5v2.7" />
        <rect x="6.5" y="13.5" width="35" height="25" rx="7" />
        <path d="M41.5 21.5h-6a4.75 4.75 0 0 0 0 9.5h6" />
      </g>
      <circle cx="35.6" cy="26.25" r={sw * 0.9} fill="var(--brand-accent)" />
    </svg>
  );
}

/** Nombre: "share" en tinta e "ito" en el primario, en la tipografía de titulares. */
export function ShareitoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading font-extrabold tracking-[-0.035em] whitespace-nowrap", className)}>
      share<span className="text-primary">ito</span>
    </span>
  );
}

/** Símbolo + nombre, en línea. */
export function ShareitoLogo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ShareitoMark className={cn("size-7 text-primary", markClassName)} small />
      <ShareitoWordmark className={cn("text-lg leading-none", wordmarkClassName)} />
    </span>
  );
}

/**
 * Icono de app: billetera blanca sobre el índigo de marca. El fondo es fijo (no cambia
 * con el tema) porque es el mismo icono que se instala en el teléfono.
 */
export function ShareitoAppIcon({ className, small = false }: { className?: string; small?: boolean }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-[23%] bg-[#5038E0] text-white", className)}>
      <ShareitoMark className="size-[79%]" small={small} />
    </span>
  );
}
