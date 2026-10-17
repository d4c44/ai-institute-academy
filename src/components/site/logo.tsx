import Image from "next/image";
import { BASE_PATH } from "@/lib/static";
import { cn } from "@/lib/utils";

// The institute's mark (public/brand/logo.png, royal blue #0028B3 on transparent, recoloured from the original
// in public/brand/source/). Served as is: re-encoding a flat-colour bitmap softens the lettering.
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={`${BASE_PATH}/brand/logo.png`}
      alt=""
      width={225}
      height={225}
      unoptimized
      className={cn("size-9 shrink-0", className)}
    />
  );
}

// Mark plus the product name as live text. The mark is used once, in the header (and on the
// certificate); everywhere else the name stands alone.
export function Logo({ name, mark = true }: { name: string; mark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {mark ? <LogoMark /> : null}
      <span className={cn("text-lg font-bold tracking-tight", mark && "max-[420px]:hidden")}>{name}</span>
    </span>
  );
}