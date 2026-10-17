import QRCode from "qrcode";
import { getFormatter, getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";

// An HTML rendition of the A4 landscape PDF the API produces. Sizes use container-query units
// (cqw), so the whole document scales as one piece at any width.
export async function CertificateDocument({
  name,
  course,
  hours,
  score,
  issuedAt,
  code,
  verifyUrl,
  sample = false,
  revoked = false,
  className,
}: {
  name: string;
  course: string;
  hours?: number | null;
  score?: number | null;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
  sample?: boolean;
  revoked?: boolean;
  className?: string;
}) {
  const t = await getTranslations("Certificate");
  const brand = await getTranslations("Brand");
  const format = await getFormatter();

  const qr = QRCode.create(verifyUrl, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const cells: [number, number][] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.modules.get(x, y)) cells.push([x, y]);

  const facts = [hours ? t("hours", { hours }) : null, score != null ? t("score", { score }) : null].filter(Boolean);

  return (
    <figure
      aria-label={sample ? t("ariaLabel") : `${t("heading")}: ${name}`}
      className={cn(
        "@container relative aspect-[1.414/1] w-full overflow-hidden rounded-sm border bg-white text-[#0b1230] shadow-sm",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-[2cqw] border-[0.45cqw] border-primary" />
      <div className="pointer-events-none absolute inset-[3cqw] border border-primary/40" />

      {sample ? (
        <span className="absolute top-[4.4cqw] right-[5cqw] rounded-[0.4cqw] border border-primary px-[1.2cqw] py-[0.4cqw] text-[1.3cqw] font-bold tracking-[0.2em] text-primary uppercase">
          {t("sample")}
        </span>
      ) : null}

      <div className="absolute inset-[3cqw] flex flex-col items-center px-[5cqw] py-[3.2cqw] text-center">
        <div className="flex items-center gap-[1cqw]">
          <LogoMark className="size-[4.6cqw]" />
          <div className="text-left leading-tight">
            <p className="text-[1.7cqw] font-bold">{brand("name")}</p>
            <p className="text-[1.2cqw] text-[#54607f]">{brand("university")}</p>
          </div>
        </div>

        <p className="mt-[2.4cqw] text-[1.6cqw] font-bold tracking-[0.3em] text-primary uppercase">{t("heading")}</p>
        <p className="mt-[1.8cqw] text-[1.5cqw] text-[#54607f]">{t("certify")}</p>
        <p className="mt-[0.8cqw] max-w-[85%] border-b border-[#0b1230]/30 px-[4cqw] pb-[0.6cqw] font-serif text-[4.2cqw] leading-tight font-semibold">
          {name}
        </p>
        <p className="mt-[1.6cqw] text-[1.5cqw] text-[#54607f]">{t("completed")}</p>
        <p className="mt-[0.6cqw] max-w-[80%] text-[2.5cqw] leading-tight font-bold text-primary">{course}</p>
        {facts.length > 0 ? <p className="mt-[1cqw] text-[1.4cqw] text-[#54607f]">{facts.join(" · ")}</p> : null}

        <div className="mt-auto flex w-full items-end justify-between gap-[3cqw] text-left">
          <div className="text-[1.3cqw] leading-snug">
            <p className="text-[#54607f]">{t("dateLabel")}</p>
            <p className="font-semibold">{format.dateTime(issuedAt, { dateStyle: "long", timeZone: "UTC" })}</p>
            <p className="mt-[0.8cqw] text-[#54607f]">{t("idLabel")}</p>
            <p className="font-mono font-semibold">{code}</p>
          </div>

          <div className="w-[22%] text-center text-[1.2cqw]">
            <div className="border-b border-[#0b1230]/40 pb-[0.4cqw] font-serif text-[2cqw] italic">{t("signature")}</div>
            <p className="mt-[0.4cqw] text-[#54607f]">{t("director")}</p>
          </div>

          <div className="flex flex-col items-center gap-[0.5cqw] text-[1.2cqw] text-[#54607f]">
            <svg
              viewBox={`-2 -2 ${size + 4} ${size + 4}`}
              role="img"
              aria-label={t("qrLabel")}
              shapeRendering="crispEdges"
              className="size-[10cqw]"
            >
              <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#fff" />
              {cells.map(([x, y]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0b1230" />
              ))}
            </svg>
            <span>{t("scan")}</span>
          </div>
        </div>
      </div>

      {revoked ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="-rotate-[18deg] rounded-[1cqw] border-[0.6cqw] border-primary/50 px-[3cqw] py-[1cqw] text-[8cqw] font-bold tracking-wide text-primary/40 uppercase">
            {t("revoked")}
          </span>
        </div>
      ) : null}
    </figure>
  );
}