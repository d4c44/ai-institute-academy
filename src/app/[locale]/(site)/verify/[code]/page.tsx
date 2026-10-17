import { VerifyResult } from "@/components/verify/verify-result";
import { verifyParams } from "@/lib/static-params";

type Props = PageProps<"/[locale]/verify/[code]">;

// The static build cannot list every code; it links to /verify?code=... instead (see verifyHref).
// Only the sample certificate keeps a page of its own.
export const generateStaticParams = verifyParams;

export default async function VerifyCodePage({ params }: Props) {
  const { code } = await params;
  return <VerifyResult code={decodeURIComponent(code)} />;
}
