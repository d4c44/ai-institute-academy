import { OverviewView } from "@/components/learn/overview-view";
import { courseParams } from "@/lib/static-params";

type Props = PageProps<"/[locale]/learn/[slug]">;

export const generateStaticParams = courseParams;

// Per-user data (progress, certificate) is loaded in the browser by OverviewView.
export default async function LearnPage({ params }: Props) {
  const { slug } = await params;
  return <OverviewView slug={slug} />;
}
