import { QuizView } from "@/components/learn/quiz-view";
import { quizParams } from "@/lib/static-params";

type Props = PageProps<"/[locale]/learn/[slug]/quizzes/[quizId]">;

export const generateStaticParams = quizParams;

export default async function QuizPage({ params }: Props) {
  const { slug, quizId } = await params;
  return <QuizView slug={slug} quizId={quizId} />;
}
