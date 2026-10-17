import { CheckIcon, CircleIcon, FileTextIcon, LockIcon, PlayCircleIcon, TrophyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type CourseProgress, type QuizState } from "@/lib/api/learning";
import { cn } from "@/lib/utils";

// Course contents with per-unit status. Locked modules are listed but not linked.
export function Outline({ course, currentId }: { course: CourseProgress; currentId?: string }) {
  const t = useTranslations("Learn");

  return (
    <nav aria-label={t("outline")} className="flex flex-col gap-5">
      {course.modules.map((module, index) => (
        <section key={module.id} aria-labelledby={`m-${module.id}`}>
          <h3 id={`m-${module.id}`} lang={course.language} className="flex items-start gap-2 text-sm font-bold">
            <span className="text-muted-foreground">{index + 1}.</span>
            <span className="flex-1">{module.title}</span>
            {module.locked ? <LockIcon className="mt-0.5 size-4 text-muted-foreground" aria-label={t("locked")} /> : null}
          </h3>
          <ul className="mt-1 flex flex-col">
            {module.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Row
                  href={module.locked ? null : `/learn/${course.slug}/lessons/${lesson.id}`}
                  current={lesson.id === currentId}
                  done={lesson.completed}
                  locked={module.locked}
                  lang={course.language}
                  icon={lesson.type === "VIDEO" ? PlayCircleIcon : FileTextIcon}
                >
                  {lesson.title}
                </Row>
              </li>
            ))}
            {module.quiz ? (
              <li>
                <QuizRow quiz={module.quiz} slug={course.slug} currentId={currentId} label={t("moduleQuiz")} />
              </li>
            ) : null}
          </ul>
        </section>
      ))}
      {course.finalExam ? (
        <section aria-label={t("finalExam")}>
          <ul>
            <li>
              <QuizRow quiz={course.finalExam} slug={course.slug} currentId={currentId} label={t("finalExam")} final />
            </li>
          </ul>
        </section>
      ) : null}
    </nav>
  );
}

function QuizRow({
  quiz,
  slug,
  currentId,
  label,
  final = false,
}: {
  quiz: QuizState;
  slug: string;
  currentId?: string;
  label: string;
  final?: boolean;
}) {
  return (
    <Row
      href={quiz.available ? `/learn/${slug}/quizzes/${quiz.id}` : null}
      current={quiz.id === currentId}
      done={quiz.passed}
      locked={!quiz.available}
      icon={final ? TrophyIcon : CheckIcon}
      strong
    >
      {label}
    </Row>
  );
}

function Row({
  href,
  current,
  done,
  locked,
  icon: Icon,
  strong,
  lang,
  children,
}: {
  href: string | null;
  current: boolean;
  done: boolean;
  locked: boolean;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  strong?: boolean;
  lang?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      {done ? (
        <CheckIcon className="size-4 shrink-0 text-emerald-700" aria-hidden />
      ) : locked ? (
        <LockIcon className="size-4 shrink-0" aria-hidden />
      ) : (
        <CircleIcon className="size-4 shrink-0" aria-hidden />
      )}
      <Icon className="size-4 shrink-0 opacity-60" aria-hidden />
      <span lang={lang} className={cn("flex-1", strong && "font-semibold")}>
        {children}
      </span>
    </>
  );
  const classes = cn(
    "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
    current && "bg-tint font-semibold text-primary",
    locked ? "text-muted-foreground" : "hover:bg-muted",
  );

  return href ? (
    <Link href={href} aria-current={current ? "page" : undefined} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}