import { COURSES, LANGS, TRACKS, localized, type Course, type Lesson, type Quiz } from "./content";

// ─────────────────────────────────────────────────────────────────────────────
// The backend of the GitHub Pages version: the same routes, JSON and rules as the Go API
// (backend/internal), answered in the visitor's browser. Accounts, progress and certificates live
// in this browser's localStorage and are never sent anywhere. At build time the same code answers
// the public catalog requests that the prerendered pages make.
// Not the production backend: no server, no PDF, nothing shared between visitors.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai-academy-static-v1";

type User = {
  id: string;
  login: string;
  fullName: string;
  email: string | null;
  courseYear: number | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  locale: string;
  createdAt: string;
  passwordHash: string;
};
type Enrollment = { status: "ACTIVE" | "COMPLETED"; enrolledAt: string; completedAt: string | null };
type Attempt = { userId: string; quizId: string; score: number; passed: boolean };
type Cert = {
  code: string;
  status: "VALID" | "REVOKED" | "SUPERSEDED";
  userId: string;
  courseSlug: string;
  recipientName: string;
  courseTitle: string;
  courseHours: number | null;
  finalScore: number | null;
  locale: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

type State = {
  users: Map<string, User>;
  /** The signed-in user of this browser (the stand-in for the session cookie). */
  currentUserId: string | null;
  enrollments: Map<string, Enrollment>; // `${userId}|${slug}`
  lessonDone: Set<string>; // `${userId}|${lessonId}`
  attempts: Attempt[];
  certs: Cert[];
};

// ─── State (kept on globalThis so hot reload and separate bundles share it) ──

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 120_000 },
    key,
    256,
  );
  return new Uint8Array(bits);
}
async function hash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${toHex(salt)}:${toHex(await derive(password, salt))}`;
}
async function verify(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const got = toHex(await derive(password, fromHex(saltHex)));
  return got.length === keyHex.length && got === keyHex;
}
const randomHex = (bytes: number) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

function seed(): State {
  const s: State = {
    users: new Map(),
    currentUserId: null,
    enrollments: new Map(),
    lessonDone: new Set(),
    attempts: [],
    certs: [],
  };
  const now = "2026-10-14T09:00:00.000Z";

// A graduate with a real certificate: the sample on the home page links to this code.
  const alumni: User = {
    id: "user-alumni",
    login: "alumni",
    fullName: "Nurlan Kulmurzaev",
    email: null,
    courseYear: null,
    role: "STUDENT",
    locale: "en",
    createdAt: now,
    passwordHash: "!",
  };
  s.users.set(alumni.id, alumni);
  const ml = COURSES.find((c) => c.slug === "ai-tools-in-education");
  if (ml) {
    s.enrollments.set(`${alumni.id}|${ml.slug}`, { status: "COMPLETED", enrolledAt: now, completedAt: now });
    s.certs.push({
      code: "AIKAU-26-7K3M-9QX2",
      status: "VALID",
      userId: alumni.id,
      courseSlug: ml.slug,
      recipientName: alumni.fullName,
      courseTitle: localized(ml, "en").title,
      courseHours: ml.hours,
      finalScore: 92,
      locale: "en",
      issuedAt: "2026-10-14T09:00:00.000Z",
      revokedAt: null,
      revokedReason: null,
    });
  }
  return s;
}

// ─── State: in memory, mirrored to localStorage in the browser ───────────────

type Saved = {
  users: [string, User][];
  currentUserId: string | null;
  enrollments: [string, Enrollment][];
  lessonDone: string[];
  attempts: Attempt[];
  certs: Cert[];
};

function load(): State {
  const fresh = seed();
  if (typeof window === "undefined") return fresh; // build time: no browser storage (Node 25 has a half-working global)
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Saved;
    // The seeded graduate always comes from code; everything else from the browser.
    const users = new Map([...fresh.users, ...saved.users]);
    const certs = [...fresh.certs, ...saved.certs.filter((c) => !fresh.certs.some((x) => x.code === c.code))];
    return {
      users,
      currentUserId: saved.currentUserId && users.has(saved.currentUserId) ? saved.currentUserId : null,
      enrollments: new Map([...fresh.enrollments, ...saved.enrollments]),
      lessonDone: new Set(saved.lessonDone),
      attempts: saved.attempts,
      certs,
    };
  } catch {
    return fresh;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  const saved: Saved = {
    users: [...state.users],
    currentUserId: state.currentUserId,
    enrollments: [...state.enrollments],
    lessonDone: [...state.lessonDone],
    attempts: state.attempts,
    certs: state.certs,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked (private window): the session still works until the page is closed.
  }
}

const state: State = load();

// ─── Small helpers ───────────────────────────────────────────────────────────

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}
const err = (status: number, code: string) => json(status, { error: code });
const validation = (fields: Record<string, string>) => json(422, { error: "validation", fields });

function newId(prefix: string) {
  return `${prefix}-${randomHex(6)}`;
}

function publicUser(u: User) {
  const { passwordHash: _omit, ...rest } = u;
  void _omit;
  return rest;
}

function userFrom(): User | null {
  return state.currentUserId ? (state.users.get(state.currentUserId) ?? null) : null;
}

// ─── Validation (mirrors backend/internal/auth) ──────────────────────────────

const LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

function checkPassword(pw: string): string {
  const n = [...pw].length;
  if (n < 8) return "too_short";
  if (n > 128) return "too_long";
  return /[^\p{L}\p{N}\s]/u.test(pw) ? "" : "needs_symbol";
}

function normalizeFullName(s: string): { name: string; ok: boolean } {
  const name = s.trim().split(/\s+/).filter(Boolean).join(" ");
  const len = [...name].length;
  const ok =
    len >= 5 && len <= 100 && name.split(" ").length >= 2 && /^[\p{L}\p{M} '’.-]+$/u.test(name);
  return { name, ok };
}

const validEmail = (s: string) => s.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);

// ─── Catalog ─────────────────────────────────────────────────────────────────

const track = (slug: string) => TRACKS.find((t) => t.slug === slug) ?? null;
const learners = (slug: string) => [...state.enrollments.keys()].filter((k) => k.endsWith(`|${slug}`)).length;

/** The language asked for with ?lang=, or "" (serve the originals). */
const langOf = (url: URL) => {
  const l = url.searchParams.get("lang") ?? "";
  return LANGS.includes(l) ? l : "";
};

function summary(course: Course, lang = "") {
  const c = localized(course, lang);
  const t = track(c.trackSlug);
  return {
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    level: c.level,
    language: c.language,
    languages: course.languages,
    estimatedHours: c.hours,
    moduleCount: c.modules.length,
    learnerCount: learners(c.slug),
    track: t ? { slug: t.slug, name: t.name } : null,
  };
}

function listCourses(q: URLSearchParams, lang: string) {
  const track_ = q.get("track") ?? "";
  const level = (q.get("level") ?? "").toUpperCase();
  const language = q.get("language") ?? "";
  const text = (q.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(q.get("limit")) || 24, 1), 60);
  const offset = Math.max(Number(q.get("offset")) || 0, 0);

  let items = COURSES.filter(
    (c) =>
      (!track_ || c.trackSlug === track_) &&
      (!level || c.level === level) &&
      (!language || c.languages.includes(language)) &&
      (!text || [c, localized(c, lang)].some((v) => v.title.toLowerCase().includes(text) || v.summary.toLowerCase().includes(text))),
  );
  const byNew = (a: Course, b: Course) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title);
  items =
    q.get("sort") === "new"
      ? items.sort(byNew)
      : items.sort((a, b) => learners(b.slug) - learners(a.slug) || byNew(a, b));
  return { items: items.slice(offset, offset + limit).map((c) => summary(c, lang)), total: items.length };
}

function courseDetail(course: Course, lang: string) {
  const c = localized(course, lang);
  return {
    ...summary(course, lang),
    description: c.description,
    learningOutcomes: c.learningOutcomes,
    prerequisites: c.prerequisites,
    sequential: true,
    hasFinalExam: c.finalExam !== null,
    publishedAt: c.publishedAt,
    instructors: [{ ...c.instructor, isLead: true }],
    modules: c.modules.map((m) => ({
      title: m.title,
      description: m.description,
      hasQuiz: m.quiz !== null,
      lessons: m.lessons.map((l) => ({
        title: l.title,
        type: "TEXT" as const,
        durationSec: l.durationSec,
        isPreview: l.isPreview,
      })),
    })),
  };
}

// ─── Learning (mirrors backend/internal/store/learning.go) ───────────────────

type Unit = { kind: "lesson" | "quiz" | "final"; id: string };

const enrollmentOf = (u: User, slug: string) => state.enrollments.get(`${u.id}|${slug}`);
const lessonDone = (u: User, id: string) => state.lessonDone.has(`${u.id}|${id}`);

function quizState(u: User, quiz: Quiz) {
  const mine = state.attempts.filter((a) => a.userId === u.id && a.quizId === quiz.id);
  return {
    id: quiz.id,
    title: quiz.title,
    passingScore: quiz.passingScore,
    maxAttempts: null as number | null,
    attemptsUsed: mine.length,
    bestScore: mine.length ? Math.max(...mine.map((a) => a.score)) : (null as number | null),
    passed: mine.some((a) => a.passed),
    available: false,
    locked: false,
  };
}

function certRef(u: User, slug: string) {
  const mine = state.certs
    .filter((c) => c.userId === u.id && c.courseSlug === slug)
    .sort((a, b) => Number(b.status === "VALID") - Number(a.status === "VALID") || b.issuedAt.localeCompare(a.issuedAt));
  const c = mine[0];
  return c ? { code: c.code, status: c.status, issuedAt: c.issuedAt } : null;
}

function progress(u: User, slug: string, lang = "") {
  const original = COURSES.find((c) => c.slug === slug);
  const enrollment = enrollmentOf(u, slug);
  if (!original || !enrollment) return null;
  const course = localized(original, lang);

  let prevDone = true;
  let total = 0;
  let done = 0;
  let next: Unit | null = null;

  const modules = course.modules.map((m) => {
    const locked = !prevDone;
    const lessons = m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      type: "TEXT" as const,
      durationSec: l.durationSec,
      completed: lessonDone(u, l.id),
    }));
    let lessonsDone = true;
    for (const l of lessons) {
      total++;
      if (l.completed) done++;
      else lessonsDone = false;
    }
    let quiz = null as ReturnType<typeof quizState> | null;
    if (m.quiz) {
      quiz = quizState(u, m.quiz);
      total++;
      quiz.locked = locked;
      quiz.available = !locked && lessonsDone;
      if (quiz.passed) done++;
    }
    const completed = lessonsDone && (!quiz || quiz.passed);
    prevDone = completed;

    if (!next && !locked && !completed) {
      if (!lessonsDone) {
        const first = lessons.find((l) => !l.completed);
        if (first) next = { kind: "lesson", id: first.id };
      } else if (quiz) {
        next = { kind: "quiz", id: quiz.id };
      }
    }
    return { id: m.id, title: m.title, description: m.description, locked, completed, lessons, quiz };
  });

  let finalExam = null as ReturnType<typeof quizState> | null;
  if (course.finalExam) {
    finalExam = quizState(u, course.finalExam);
    total++;
    const allDone = modules.every((m) => m.completed);
    finalExam.locked = !allDone;
    finalExam.available = allDone;
    if (finalExam.passed) done++;
    if (!next && allDone && !finalExam.passed) next = { kind: "final", id: finalExam.id };
  }

  return {
    slug: course.slug,
    title: course.title,
    language: course.language,
    estimatedHours: course.hours,
    sequential: true,
    status: enrollment.status,
    progressPercent: total > 0 ? Math.floor((done * 100) / total) : 0,
    completedUnits: done,
    totalUnits: total,
    modules,
    finalExam,
    next: next as Unit | null,
    certificate: certRef(u, slug),
  };
}

type Progress = NonNullable<ReturnType<typeof progress>>;

function unitAfter(p: Progress, kind: string, id: string): Unit | null {
  const order: Unit[] = [];
  for (const m of p.modules) {
    for (const l of m.lessons) order.push({ kind: "lesson", id: l.id });
    if (m.quiz) order.push({ kind: "quiz", id: m.quiz.id });
  }
  if (p.finalExam) order.push({ kind: "final", id: p.finalExam.id });
  const i = order.findIndex((u) => u.id === id && (u.kind === kind || (kind === "quiz" && u.kind === "final")));
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}

function findLesson(id: string, lang: string): { course: Course; moduleIndex: number; lesson: Lesson } | null {
  for (const course of COURSES.map((c) => localized(c, lang))) {
    for (let mi = 0; mi < course.modules.length; mi++) {
      const lesson = course.modules[mi].lessons.find((l) => l.id === id);
      if (lesson) return { course, moduleIndex: mi, lesson };
    }
  }
  return null;
}

function findQuiz(id: string, lang: string): { course: Course; quiz: Quiz; moduleTitle: string | null; isFinal: boolean } | null {
  for (const course of COURSES.map((c) => localized(c, lang))) {
    if (course.finalExam?.id === id) return { course, quiz: course.finalExam, moduleTitle: null, isFinal: true };
    for (const m of course.modules) if (m.quiz?.id === id) return { course, quiz: m.quiz, moduleTitle: m.title, isFinal: false };
  }
  return null;
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `AIKAU-${String(new Date().getFullYear() % 100).padStart(2, "0")}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Issues the certificate when every lesson is done and every quiz and the final exam are passed. */
function issueIfEligible(u: User, course: Course) {
  const enrollment = enrollmentOf(u, course.slug);
  if (!enrollment || state.certs.some((c) => c.userId === u.id && c.courseSlug === course.slug)) return;

  const lessons = course.modules.flatMap((m) => m.lessons);
  const quizzes = [...course.modules.flatMap((m) => (m.quiz ? [m.quiz] : [])), ...(course.finalExam ? [course.finalExam] : [])];
  const passed = (q: Quiz) => state.attempts.some((a) => a.userId === u.id && a.quizId === q.id && a.passed);
  if (lessons.length === 0 || !lessons.every((l) => lessonDone(u, l.id)) || !quizzes.every(passed)) return;

  const finalScore = course.finalExam
    ? Math.max(...state.attempts.filter((a) => a.userId === u.id && a.quizId === course.finalExam!.id && a.passed).map((a) => a.score))
    : null;
  const issuedAt = new Date().toISOString();
  enrollment.status = "COMPLETED";
  enrollment.completedAt ??= issuedAt;
  state.certs.push({
    code: newCode(),
    status: "VALID",
    userId: u.id,
    courseSlug: course.slug,
    recipientName: u.fullName,
    courseTitle: localized(course, u.locale).title,
    courseHours: course.hours,
    finalScore,
    locale: u.locale,
    issuedAt,
    revokedAt: null,
    revokedReason: null,
  });
}

/** The course title in `lang` when that differs from the language the certificate was issued in. */
function certTitle(c: Cert, lang: string) {
  if (!lang || lang === c.locale) return c.courseTitle;
  const course = COURSES.find((x) => x.slug === c.courseSlug);
  return course ? localized(course, lang).title : c.courseTitle;
}

function publicCert(c: Cert, lang = "") {
  return {
    code: c.code,
    status: c.status,
    recipientName: c.recipientName,
    courseTitle: certTitle(c, lang),
    courseHours: c.courseHours,
    finalScore: c.finalScore,
    locale: c.locale,
    issuedAt: c.issuedAt,
    revokedAt: c.revokedAt,
    revokedReason: c.revokedReason,
  };
}

// ─── Request dispatcher ──────────────────────────────────────────────────────

type Ctx = { user: User | null; headers: Headers; body: string | undefined; url: URL; params: string[] };
type Handler = (ctx: Ctx) => Response | Promise<Response>;

function parseBody<T>(ctx: Ctx): T | Response {
  if (!(ctx.headers.get("content-type") ?? "").startsWith("application/json")) return err(415, "unsupported_media_type");
  try {
    return JSON.parse(ctx.body ?? "") as T;
  } catch {
    return err(400, "bad_request");
  }
}
const needUser = (h: (ctx: Ctx & { user: User }) => Response | Promise<Response>): Handler => (ctx) =>
  ctx.user ? h({ ...ctx, user: ctx.user }) : err(401, "unauthorized");

function startSession(u: User) {
  state.currentUserId = u.id;
}

type Registration = { fullName: string; login: string; email: string; courseYear: number; password: string; locale: string };

const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/healthz$/, () => json(200, { status: "ok", database: "browser" })],
  [
    "GET",
    /^\/api\/v1\/stats$/,
    () =>
      json(200, {
        courses: COURSES.length,
        tracks: new Set(COURSES.map((c) => c.trackSlug)).size,
        languages: new Set(COURSES.flatMap((c) => c.languages)).size,
        learners: new Set([...state.enrollments.keys()].map((k) => k.split("|")[0])).size,
      }),
  ],
  [
    "GET",
    /^\/api\/v1\/tracks$/,
    () =>
      json(
        200,
        TRACKS.map((t) => ({
          slug: t.slug,
          name: t.name,
          description: t.description,
          courseCount: COURSES.filter((c) => c.trackSlug === t.slug).length,
        })),
      ),
  ],
  ["GET", /^\/api\/v1\/courses$/, ({ url }) => json(200, listCourses(url.searchParams, langOf(url)))],
  [
    "GET",
    /^\/api\/v1\/courses\/([^/]+)$/,
    ({ params, url }) => {
      const c = COURSES.find((x) => x.slug === params[0]);
      return c ? json(200, courseDetail(c, langOf(url))) : err(404, "not_found");
    },
  ],

  // Accounts
  [
    "POST",
    /^\/api\/v1\/auth\/register$/,
    async (ctx) => {
      const b = parseBody<Registration>(ctx);
      if (b instanceof Response) return b;
      const fields: Record<string, string> = {};
      const { name, ok } = normalizeFullName(String(b.fullName ?? ""));
      if (!ok) fields.fullName = "invalid";
      const login = String(b.login ?? "").trim();
      if (!LOGIN_RE.test(login)) fields.login = "invalid";
      const email = String(b.email ?? "").trim();
      if (email && !validEmail(email)) fields.email = "invalid";
      const year = Number(b.courseYear) || 0;
      if (!year) fields.courseYear = "required";
      else if (year < 1 || year > 6) fields.courseYear = "invalid";
      const pw = String(b.password ?? "");
      const pwProblem = checkPassword(pw);
      if (pwProblem) fields.password = pwProblem;
      if (Object.keys(fields).length) return validation(fields);

      const users = [...state.users.values()];
      if (users.some((u) => u.login.toLowerCase() === login.toLowerCase())) return validation({ login: "taken" });
      if (email && users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) return validation({ email: "taken" });

      const user: User = {
        id: newId("user"),
        login,
        fullName: name,
        email: email || null,
        courseYear: year,
        role: "STUDENT",
        locale: LANGS.includes(b.locale) ? b.locale : "kk",
        createdAt: new Date().toISOString(),
        passwordHash: await hash(pw),
      };
      state.users.set(user.id, user);
      startSession(user);
      return json(201, publicUser(user));
    },
  ],
  [
    "POST",
    /^\/api\/v1\/auth\/login$/,
    async (ctx) => {
      const b = parseBody<{ login: string; password: string }>(ctx);
      if (b instanceof Response) return b;
      const id = String(b.login ?? "").trim().toLowerCase();
      const user = [...state.users.values()].find((u) => u.login.toLowerCase() === id || u.email?.toLowerCase() === id);
      if (!id || !user || !(await verify(String(b.password ?? ""), user.passwordHash))) return err(401, "invalid_credentials");
      startSession(user);
      return json(200, publicUser(user));
    },
  ],
  [
    "POST",
    /^\/api\/v1\/auth\/logout$/,
    () => {
      state.currentUserId = null;
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    },
  ],
  ["GET", /^\/api\/v1\/me$/, needUser(({ user }) => json(200, publicUser(user)))],
  [
    "PATCH",
    /^\/api\/v1\/me$/,
    needUser((ctx) => {
      const b = parseBody<{ fullName: string; courseYear: number; email: string }>(ctx);
      if (b instanceof Response) return b;
      const fields: Record<string, string> = {};
      const { name, ok } = normalizeFullName(String(b.fullName ?? ""));
      if (!ok) fields.fullName = "invalid";
      const year = Number(b.courseYear) || 0;
      if (year && (year < 1 || year > 6)) fields.courseYear = "invalid";
      const email = String(b.email ?? "").trim();
      if (email && !validEmail(email)) fields.email = "invalid";
      if (Object.keys(fields).length) return validation(fields);
      if (email && [...state.users.values()].some((u) => u.id !== ctx.user.id && u.email?.toLowerCase() === email.toLowerCase())) {
        return validation({ email: "taken" });
      }
      ctx.user.fullName = name;
      ctx.user.courseYear = year || null;
      ctx.user.email = email || null;
      return json(200, publicUser(ctx.user));
    }),
  ],
  [
    "GET",
    /^\/api\/v1\/me\/enrollments$/,
    needUser(({ user, url }) => {
      const lang = langOf(url);
      const out = [...state.enrollments.entries()]
        .filter(([k]) => k.startsWith(`${user.id}|`))
        .sort(([, a], [, b]) => b.enrolledAt.localeCompare(a.enrolledAt))
        .flatMap(([k, e]) => {
          const course = COURSES.find((c) => c.slug === k.split("|")[1]);
          const p = course && progress(user, course.slug, lang);
          if (!course || !p) return [];
          const lessons = course.modules.flatMap((m) => m.lessons);
          const completed = lessons.filter((l) => lessonDone(user, l.id)).length;
          return [
            {
              ...summary(course, lang),
              status: e.status,
              enrolledAt: e.enrolledAt,
              completedAt: e.completedAt,
              lessonCount: lessons.length,
              completedLessons: completed,
              progressPercent: lessons.length ? Math.floor((completed * 100) / lessons.length) : 0,
            },
          ];
        });
      return json(200, out);
    }),
  ],
  [
    "POST",
    /^\/api\/v1\/courses\/([^/]+)\/enroll$/,
    needUser(({ user, params }) => {
      if (!COURSES.some((c) => c.slug === params[0])) return err(404, "not_found");
      const key = `${user.id}|${params[0]}`;
      if (!state.enrollments.has(key)) {
        state.enrollments.set(key, { status: "ACTIVE", enrolledAt: new Date().toISOString(), completedAt: null });
      }
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }),
  ],

  // Learning
  [
    "GET",
    /^\/api\/v1\/me\/courses\/([^/]+)$/,
    needUser(({ user, params, url }) => {
      const p = progress(user, params[0], langOf(url));
      return p ? json(200, p) : err(404, "not_found");
    }),
  ],
  [
    "GET",
    /^\/api\/v1\/me\/lessons\/([^/]+)$/,
    needUser(({ user, params, url }) => {
      const lang = langOf(url);
      const found = findLesson(params[0], lang);
      if (!found) return err(404, "not_found");
      const p = progress(user, found.course.slug, lang);
      if (!p) return err(404, "not_found");
      if (p.modules[found.moduleIndex].locked) return err(403, "locked");
      return json(200, {
        id: found.lesson.id,
        title: found.lesson.title,
        type: "TEXT",
        content: found.lesson.content,
        videoUrl: null,
        durationSec: found.lesson.durationSec,
        completed: lessonDone(user, found.lesson.id),
        moduleTitle: found.course.modules[found.moduleIndex].title,
        courseSlug: found.course.slug,
        courseTitle: found.course.title,
        language: found.course.language,
        next: unitAfter(p, "lesson", found.lesson.id),
      });
    }),
  ],
  [
    "POST",
    /^\/api\/v1\/me\/lessons\/([^/]+)\/complete$/,
    needUser(({ user, params, url }) => {
      const lang = langOf(url);
      const found = findLesson(params[0], lang);
      if (!found) return err(404, "not_found");
      const before = progress(user, found.course.slug, lang);
      if (!before) return err(404, "not_found");
      if (before.modules[found.moduleIndex].locked) return err(403, "locked");
      state.lessonDone.add(`${user.id}|${found.lesson.id}`);
      issueIfEligible(user, found.course);
      const p = progress(user, found.course.slug, lang)!;
      return json(200, { progress: p, next: unitAfter(p, "lesson", found.lesson.id), certificate: p.certificate });
    }),
  ],
  [
    "GET",
    /^\/api\/v1\/me\/quizzes\/([^/]+)$/,
    needUser(({ user, params, url }) => {
      const lang = langOf(url);
      const found = findQuiz(params[0], lang);
      if (!found) return err(404, "not_found");
      const p = progress(user, found.course.slug, lang);
      if (!p) return err(404, "not_found");
      const st = found.isFinal ? p.finalExam : p.modules.find((m) => m.quiz?.id === found.quiz.id)?.quiz;
      if (!st) return err(404, "not_found");
      if (!st.available) return err(403, "locked");
      return json(200, {
        id: st.id,
        title: st.title,
        isFinal: found.isFinal,
        passingScore: st.passingScore,
        maxAttempts: null,
        attemptsUsed: st.attemptsUsed,
        bestScore: st.bestScore,
        passed: st.passed,
        moduleTitle: found.moduleTitle,
        courseSlug: found.course.slug,
        courseTitle: found.course.title,
        language: found.course.language,
        // is_correct is never sent to the browser
        questions: found.quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        })),
      });
    }),
  ],
  [
    "POST",
    /^\/api\/v1\/me\/quizzes\/([^/]+)\/submit$/,
    needUser((ctx) => {
      const { user, params } = ctx;
      const lang = langOf(ctx.url);
      const b = parseBody<{ answers: Record<string, string[]> }>(ctx);
      if (b instanceof Response) return b;
      const found = findQuiz(params[0], lang);
      if (!found) return err(404, "not_found");
      const p = progress(user, found.course.slug, lang);
      if (!p) return err(404, "not_found");
      const st = found.isFinal ? p.finalExam : p.modules.find((m) => m.quiz?.id === found.quiz.id)?.quiz;
      if (!st) return err(404, "not_found");
      if (!st.available) return err(403, "locked");

      let earned = 0;
      let possible = 0;
      let correctCount = 0;
      const results = found.quiz.questions.map((q) => {
        possible += q.points;
        const valid = new Set(q.options.map((o) => o.id));
        const picked = new Set((b.answers?.[q.id] ?? []).filter((id) => valid.has(id)));
        const correct = new Set(q.options.filter((o) => o.correct).map((o) => o.id));
        let ok = picked.size === correct.size && picked.size > 0 && [...picked].every((id) => correct.has(id));
        if (q.type !== "MULTIPLE_CHOICE" && picked.size > 1) ok = false;
        if (ok) {
          earned += q.points;
          correctCount++;
        }
        return { questionId: q.id, correct: ok, explanation: q.explanation };
      });
      const score = Math.floor((earned * 100) / possible);
      const passed = score >= found.quiz.passingScore;
      state.attempts.push({ userId: user.id, quizId: found.quiz.id, score, passed });

      issueIfEligible(user, found.course);
      const after = progress(user, found.course.slug, lang)!;
      return json(200, {
        score,
        passed,
        passingScore: found.quiz.passingScore,
        correctCount,
        total: found.quiz.questions.length,
        attemptsUsed: st.attemptsUsed + 1,
        maxAttempts: null,
        results,
        next: passed ? unitAfter(after, found.isFinal ? "final" : "quiz", found.quiz.id) : null,
        certificate: after.certificate,
        courseSlug: found.course.slug,
      });
    }),
  ],

  // Certificates
  [
    "GET",
    /^\/api\/v1\/me\/certificates$/,
    needUser(({ user }) =>
      json(
        200,
        state.certs
          .filter((c) => c.userId === user.id)
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
          .map((c) => ({ ...publicCert(c), courseSlug: c.courseSlug })),
      ),
    ),
  ],
  [
    "GET",
    /^\/api\/v1\/certificates\/([^/]+)$/,
    ({ params, url }) => {
      const c = state.certs.find((x) => x.code === decodeURIComponent(params[0]).trim().toUpperCase());
      return c ? json(200, publicCert(c, langOf(url))) : err(404, "not_found");
    },
  ],
];

/** Answers an API request in-process. `path` includes the query string. */
export async function localFetch(
  path: string,
  init: { method?: string; body?: string | null } = {},
): Promise<Response> {
  const url = new URL(path, "http://local.static");
  const method = (init.method ?? "GET").toUpperCase();

  for (const [m, re, handler] of routes) {
    if (m !== method) continue;
    const match = re.exec(url.pathname);
    if (!match) continue;
    const headers = new Headers({ "content-type": "application/json" });
    const res = await handler({ user: userFrom(), headers, body: init.body ?? undefined, url, params: match.slice(1) });
    if (method !== "GET") persist();
    return res;
  }
  return err(404, "not_found");
}
