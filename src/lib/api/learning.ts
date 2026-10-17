import { BASE_PATH, STATIC } from "@/lib/static";

// Shapes mirror backend/internal/store/learning.go and certificates.go.

export type NextUnit = { kind: "lesson" | "quiz" | "final"; id: string };

export type CertificateRef = { code: string; status: "VALID" | "REVOKED" | "SUPERSEDED"; issuedAt: string };

export type LessonState = {
  id: string;
  title: string;
  type: "VIDEO" | "TEXT";
  durationSec: number | null;
  completed: boolean;
};

export type QuizState = {
  id: string;
  title: string;
  passingScore: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestScore: number | null;
  passed: boolean;
  available: boolean;
  locked: boolean;
};

export type ModuleState = {
  id: string;
  title: string;
  description: string | null;
  locked: boolean;
  completed: boolean;
  lessons: LessonState[];
  quiz: QuizState | null;
};

export type CourseProgress = {
  slug: string;
  title: string;
  language: string;
  estimatedHours: number | null;
  sequential: boolean;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  progressPercent: number;
  completedUnits: number;
  totalUnits: number;
  modules: ModuleState[];
  finalExam: QuizState | null;
  next: NextUnit | null;
  certificate: CertificateRef | null;
};

export type LessonDetail = {
  id: string;
  title: string;
  type: "VIDEO" | "TEXT";
  content: string | null;
  videoUrl: string | null;
  durationSec: number | null;
  completed: boolean;
  moduleTitle: string;
  courseSlug: string;
  courseTitle: string;
  language: string;
  next: NextUnit | null;
};

export type QuizQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
};

export type QuizDetail = {
  id: string;
  title: string;
  isFinal: boolean;
  passingScore: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestScore: number | null;
  passed: boolean;
  moduleTitle: string | null;
  courseSlug: string;
  courseTitle: string;
  language: string;
  questions: QuizQuestion[];
};

export type QuizResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  correctCount: number;
  total: number;
  attemptsUsed: number;
  maxAttempts: number | null;
  results: { questionId: string; correct: boolean; explanation: string | null }[];
  next: NextUnit | null;
  certificate: CertificateRef | null;
  courseSlug: string;
};

export type CompletionResult = {
  next: NextUnit | null;
  certificate: CertificateRef | null;
};

export type PublicCertificate = {
  code: string;
  status: "VALID" | "REVOKED" | "SUPERSEDED";
  recipientName: string;
  courseTitle: string;
  courseHours: number | null;
  finalScore: number | null;
  locale: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type OwnCertificate = PublicCertificate & { courseSlug: string };

/** Where a unit lives, as a locale-less path for the i18n Link/router. */
export function unitHref(slug: string, unit: NextUnit | null): string {
  if (!unit) return `/learn/${slug}`;
  return unit.kind === "lesson" ? `/learn/${slug}/lessons/${unit.id}` : `/learn/${slug}/quizzes/${unit.id}`;
}

/** Link target (for the i18n Link/router) of a certificate's public page. */
export function verifyHref(code: string) {
  // The static site cannot have a page per code: it reads the code from the query string.
  return STATIC ? { pathname: "/verify" as const, query: { code } } : (`/verify/${encodeURIComponent(code)}` as const);
}

/** Absolute URL of a certificate's page, as encoded in its QR code. `base` is the site's origin. */
export function publicVerifyUrl(base: string, locale: string, code: string): string {
  const root = base.replace(/\/$/, "");
  return STATIC
    ? `${root}${BASE_PATH}/${locale}/verify/?${new URLSearchParams({ code })}`
    : `${root}/verify/${encodeURIComponent(code)}`;
}

/**
 * Where the PDF of a certificate comes from. The Go API renders it; the static site has no PDF, so it
 * opens the certificate page and prints it (the browser can save that as PDF).
 */
export function certificatePdfUrl(code: string, lang: string, download = false): string {
  if (STATIC) return `${BASE_PATH}/${lang}/verify/?${new URLSearchParams({ code, print: "1" })}`;
  const qs = new URLSearchParams({ lang });
  if (download) qs.set("download", "1");
  return `/api/v1/certificates/${encodeURIComponent(code)}/pdf?${qs}`;
}
