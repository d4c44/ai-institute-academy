import { STATIC } from "@/lib/static";
import { COURSES } from "@/static/content";

// generateStaticParams for the dynamic routes.
//
// The static (GitHub Pages) build needs every page listed. The normal build renders them on demand,
// but Cache Components insists on at least one entry per route, so it lists a placeholder that
// renders without calling the API ("_" is not a real slug, lesson or quiz id).

export const PLACEHOLDER = "_";

export const courseParams = () => (STATIC ? COURSES.map((c) => ({ slug: c.slug })) : [{ slug: PLACEHOLDER }]);

export const lessonParams = () =>
  STATIC
    ? COURSES.flatMap((c) =>
        c.modules.flatMap((m) => m.lessons.map((l) => ({ slug: c.slug, lessonId: l.id }))),
      )
    : [{ slug: PLACEHOLDER, lessonId: PLACEHOLDER }];

export const quizParams = () =>
  STATIC
    ? COURSES.flatMap((c) => [
        ...c.modules.flatMap((m) => (m.quiz ? [{ slug: c.slug, quizId: m.quiz.id }] : [])),
        ...(c.finalExam ? [{ slug: c.slug, quizId: c.finalExam.id }] : []),
      ])
    : [{ slug: PLACEHOLDER, quizId: PLACEHOLDER }];

export const verifyParams = () => [{ code: STATIC ? "AIKAU-26-7K3M-9QX2" : PLACEHOLDER }];
