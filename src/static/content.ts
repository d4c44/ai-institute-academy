import raw from "./content.json";

// Course content for the GitHub Pages version. content.json is generated from the Go seed
// (`npm run static:content`), so the example courses are written once.

export type Option = { id: string; text: string; correct: boolean };
export type Question = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  prompt: string;
  explanation: string | null;
  points: number;
  options: Option[];
};
export type Quiz = { id: string; title: string; passingScore: number; questions: Question[] };
export type Lesson = {
  id: string;
  title: string;
  content: string;
  durationSec: number;
  isPreview: boolean;
};
export type Module = { id: string; title: string; description: string | null; lessons: Lesson[]; quiz: Quiz | null };
export type Course = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  language: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  trackSlug: string;
  hours: number;
  publishedAt: string;
  learningOutcomes: string[];
  prerequisites: string[];
  modules: Module[];
  finalExam: Quiz | null;
  instructor: { name: string; headline: string | null; bio: string | null };
  /** The language of the original text, then every language it has been translated into. */
  languages: string[];
  i18n: Record<string, TrCourse>;
};
export type Track = { slug: string; name: string; description: string };

// Translations of a course (generated from backend/cmd/seed/i18n). Matched to the original by
// position; anything missing falls back to the original text, as in the Go API.
type TrQuiz = { title?: string; questions?: { prompt?: string; explanation?: string; options?: string[] }[] };
type TrCourse = {
  title?: string;
  summary?: string;
  description?: string;
  outcomes?: string[];
  prerequisites?: string[];
  modules?: {
    title?: string;
    description?: string;
    lessons?: { title?: string; content?: string }[];
    quiz?: TrQuiz;
  }[];
  finalExam?: TrQuiz;
};

type RawQuiz = (typeof raw.courses)[number]["finalExam"];

function buildQuiz(id: string, quiz: NonNullable<RawQuiz>): Quiz {
  return {
    id,
    title: quiz.title,
    passingScore: quiz.passing || 70,
    questions: quiz.questions.map((q, qi) => ({
      id: `${id}-q${qi + 1}`,
      type: q.type as Question["type"],
      prompt: q.prompt,
      explanation: q.explanation || null,
      points: 1,
      options: q.options.map((o, oi) => ({ id: `${id}-q${qi + 1}-o${oi + 1}`, text: o.text, correct: o.correct })),
    })),
  };
}

export const TRACKS: Track[] = raw.tracks;

export const COURSES: Course[] = raw.courses.map((c) => ({
  slug: c.slug,
  title: c.title,
  summary: c.summary,
  description: c.description,
  language: c.language,
  level: c.level as Course["level"],
  trackSlug: c.track,
  hours: c.hours,
  publishedAt: c.published,
  learningOutcomes: c.outcomes,
  prerequisites: c.prerequisites,
  modules: c.modules.map((m, mi) => ({
    id: `${c.slug}-m${mi + 1}`,
    title: m.title,
    description: m.description || null,
    lessons: m.lessons.map((l, li) => ({
      id: `${c.slug}-m${mi + 1}-l${li + 1}`,
      title: l.title,
      content: l.content,
      durationSec: l.minutes * 60,
      isPreview: l.preview,
    })),
    quiz: m.quiz ? buildQuiz(`${c.slug}-m${mi + 1}-quiz`, m.quiz) : null,
  })),
  finalExam: c.finalExam ? buildQuiz(`${c.slug}-final`, c.finalExam) : null,
  instructor: {
    name: c.instructor.name,
    headline: c.instructor.headline || null,
    bio: c.instructor.bio || null,
  },
  languages: [c.language, ...Object.keys(c.i18n ?? {})],
  i18n: (c.i18n ?? {}) as unknown as Record<string, TrCourse>,
}));

const localizedCache = new Map<string, Course>();

function localizeQuiz(q: Quiz, t: TrQuiz | undefined): Quiz {
  if (!t) return q;
  return {
    ...q,
    title: t.title || q.title,
    questions: q.questions.map((question, qi) => {
      const tq = t.questions?.[qi];
      if (!tq) return question;
      return {
        ...question,
        prompt: tq.prompt || question.prompt,
        explanation: tq.explanation || question.explanation,
        options: question.options.map((o, oi) => ({ ...o, text: tq.options?.[oi] || o.text })),
      };
    }),
  };
}

/**
 * The course as served in `lang`: translated text where a translation exists, the original
 * otherwise. Ids and structure are identical, so progress and grading do not depend on the language.
 */
export function localized(course: Course, lang: string): Course {
  const t = lang && lang !== course.language ? course.i18n[lang] : undefined;
  if (!t) return course;
  const key = `${course.slug}|${lang}`;
  const hit = localizedCache.get(key);
  if (hit) return hit;

  const out: Course = {
    ...course,
    title: t.title || course.title,
    summary: t.summary || course.summary,
    description: t.description || course.description,
    language: lang,
    learningOutcomes: t.outcomes?.length ? t.outcomes : course.learningOutcomes,
    prerequisites: t.prerequisites?.length ? t.prerequisites : course.prerequisites,
    modules: course.modules.map((m, mi) => {
      const tm = t.modules?.[mi];
      if (!tm) return m;
      return {
        ...m,
        title: tm.title || m.title,
        description: tm.description || m.description,
        lessons: m.lessons.map((l, li) => ({
          ...l,
          title: tm.lessons?.[li]?.title || l.title,
          content: tm.lessons?.[li]?.content || l.content,
        })),
        quiz: m.quiz ? localizeQuiz(m.quiz, tm.quiz) : null,
      };
    }),
    finalExam: course.finalExam ? localizeQuiz(course.finalExam, t.finalExam) : null,
  };
  localizedCache.set(key, out);
  return out;
}

export const LANGS = ["kk", "ru", "en", "ko"];
