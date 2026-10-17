import { LessonView } from "@/components/learn/lesson-view";
import { lessonParams } from "@/lib/static-params";

type Props = PageProps<"/[locale]/learn/[slug]/lessons/[lessonId]">;

export const generateStaticParams = lessonParams;

export default async function LessonPage({ params }: Props) {
  const { slug, lessonId } = await params;
  return <LessonView slug={slug} lessonId={lessonId} />;
}
