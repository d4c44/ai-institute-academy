-- +goose Up
-- +goose StatementBegin

-- AI Institute · Korkyt Ata Kyzylorda University. PostgreSQL 18.
--
-- Conventions
-- - Primary keys are uuidv7() (time-ordered, native in PostgreSQL 18).
-- - Children are ordered by an integer `position`.
-- - Completion %, module lock state and "next lesson" are derived from lesson_progress and
--   quiz_attempts, never stored. enrollments.completed_at is stamped once, when every
--   requirement is met.
-- - certificates snapshot the recipient name and course title at issue time. They are revoked or
--   superseded, never deleted, so a QR code printed years ago still resolves.

-- ─── Users & sessions ────────────────────────────────────────────────────────

CREATE TABLE users (
    id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
    login              text        NOT NULL,       -- what the person signs in with (unique, case-insensitive)
    full_name          text        NOT NULL,       -- printed on certificates
    email              text,                       -- optional until email verification exists
    course_year        smallint    CHECK (course_year BETWEEN 1 AND 6),  -- student's year of study
    password_hash      text        NOT NULL,       -- argon2id
    role               text        NOT NULL DEFAULT 'STUDENT'
                       CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'ADMIN')),
    locale             text        NOT NULL DEFAULT 'kk' CHECK (locale IN ('kk', 'ru', 'en')),
    headline           text,                       -- instructors, e.g. "PhD, Associate Professor"
    bio                text,
    email_verified_at  timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_login_key ON users (lower(login));
CREATE UNIQUE INDEX users_email_key ON users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX users_role_idx ON users (role);

-- The browser holds a random token; only its SHA-256 is stored, so a database leak can't be replayed.
CREATE TABLE sessions (
    id          uuid        PRIMARY KEY DEFAULT uuidv7(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  bytea       NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    ip          text,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ─── Catalog ─────────────────────────────────────────────────────────────────

CREATE TABLE tracks (
    id           uuid    PRIMARY KEY DEFAULT uuidv7(),
    slug         text    NOT NULL UNIQUE,
    name         text    NOT NULL,
    description  text,
    position     integer NOT NULL DEFAULT 0
);

CREATE TABLE courses (
    id                uuid        PRIMARY KEY DEFAULT uuidv7(),
    slug              text        NOT NULL UNIQUE,
    track_id          uuid        REFERENCES tracks (id) ON DELETE SET NULL,
    title             text        NOT NULL,
    summary           text        NOT NULL,         -- one line for catalog cards
    description       text        NOT NULL,         -- Markdown overview for the detail page
    cover_image_url   text,
    level             text        NOT NULL CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    language          text        NOT NULL DEFAULT 'kk',  -- language the course is taught in
    status            text        NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    estimated_hours   integer,
    learning_outcomes text[]      NOT NULL DEFAULT '{}',
    prerequisites     text[]      NOT NULL DEFAULT '{}',
    sequential        boolean     NOT NULL DEFAULT true,  -- lock each module until the previous one is done
    published_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_status_level_idx ON courses (status, level);
CREATE INDEX courses_track_idx ON courses (track_id);

-- Who may edit a course and who is shown on its page. Admins can edit everything.
CREATE TABLE course_instructors (
    course_id  uuid    NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    user_id    uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_lead    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (course_id, user_id)
);
CREATE INDEX course_instructors_user_idx ON course_instructors (user_id);

-- ─── Content ─────────────────────────────────────────────────────────────────

CREATE TABLE modules (
    id           uuid        PRIMARY KEY DEFAULT uuidv7(),
    course_id    uuid        NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    title        text        NOT NULL,
    description  text,
    position     integer     NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX modules_course_position_idx ON modules (course_id, position);

CREATE TABLE lessons (
    id            uuid        PRIMARY KEY DEFAULT uuidv7(),
    module_id     uuid        NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    title         text        NOT NULL,
    type          text        NOT NULL CHECK (type IN ('VIDEO', 'TEXT')),
    content       text,                              -- Markdown: lesson body, or notes under a video
    video_url     text,
    duration_sec  integer,
    position      integer     NOT NULL,
    is_preview    boolean     NOT NULL DEFAULT false, -- viewable on the public course page
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_module_position_idx ON lessons (module_id, position);

-- A quiz belongs to exactly one module (end-of-module quiz) or one course (final exam).
CREATE TABLE quizzes (
    id                  uuid    PRIMARY KEY DEFAULT uuidv7(),
    module_id           uuid    UNIQUE REFERENCES modules (id) ON DELETE CASCADE,
    final_for_course_id uuid    UNIQUE REFERENCES courses (id) ON DELETE CASCADE,
    title               text    NOT NULL,
    passing_score       integer NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
    max_attempts        integer,                      -- NULL = unlimited
    time_limit_sec      integer,
    shuffle_questions   boolean NOT NULL DEFAULT true,
    CONSTRAINT quizzes_exactly_one_owner CHECK (num_nonnulls(module_id, final_for_course_id) = 1)
);

CREATE TABLE questions (
    id           uuid    PRIMARY KEY DEFAULT uuidv7(),
    quiz_id      uuid    NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
    type         text    NOT NULL DEFAULT 'SINGLE_CHOICE'
                 CHECK (type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')),
    prompt       text    NOT NULL,                    -- Markdown
    explanation  text,                                -- shown after the attempt is submitted
    points       integer NOT NULL DEFAULT 1,
    position     integer NOT NULL
);
CREATE INDEX questions_quiz_position_idx ON questions (quiz_id, position);

CREATE TABLE question_options (
    id           uuid    PRIMARY KEY DEFAULT uuidv7(),
    question_id  uuid    NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
    text         text    NOT NULL,
    is_correct   boolean NOT NULL DEFAULT false,      -- never sent to the browser; grading is server-side
    position     integer NOT NULL
);
CREATE INDEX question_options_question_idx ON question_options (question_id);

-- ─── Learning ────────────────────────────────────────────────────────────────

CREATE TABLE enrollments (
    id                uuid        PRIMARY KEY DEFAULT uuidv7(),
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    course_id         uuid        NOT NULL REFERENCES courses (id) ON DELETE RESTRICT, -- archive, don't delete
    status            text        NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'COMPLETED', 'DROPPED')),
    enrolled_at       timestamptz NOT NULL DEFAULT now(),
    last_accessed_at  timestamptz,
    completed_at      timestamptz,
    UNIQUE (user_id, course_id)
);
CREATE INDEX enrollments_course_status_idx ON enrollments (course_id, status);

-- One row per (student, lesson). Kept per user rather than per enrollment so progress
-- survives a drop and re-enroll.
CREATE TABLE lesson_progress (
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lesson_id     uuid        NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
    position_sec  integer     NOT NULL DEFAULT 0,     -- video resume point
    completed_at  timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX lesson_progress_lesson_idx ON lesson_progress (lesson_id);

CREATE TABLE quiz_attempts (
    id            uuid        PRIMARY KEY DEFAULT uuidv7(),
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    quiz_id       uuid        NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
    answers       jsonb       NOT NULL DEFAULT '{}',  -- { questionId: [optionId, ...] }
    score         integer     CHECK (score IS NULL OR score BETWEEN 0 AND 100),
    passed        boolean     NOT NULL DEFAULT false,
    started_at    timestamptz NOT NULL DEFAULT now(),
    submitted_at  timestamptz
);
CREATE INDEX quiz_attempts_user_quiz_idx ON quiz_attempts (user_id, quiz_id);
CREATE INDEX quiz_attempts_quiz_submitted_idx ON quiz_attempts (quiz_id, submitted_at);

-- ─── Certificates ────────────────────────────────────────────────────────────

CREATE TABLE certificates (
    id             uuid        PRIMARY KEY DEFAULT uuidv7(),
    code           text        NOT NULL UNIQUE,       -- public ID printed on the PDF and in the QR
    status         text        NOT NULL DEFAULT 'VALID'
                   CHECK (status IN ('VALID', 'REVOKED', 'SUPERSEDED')),
    enrollment_id  uuid        NOT NULL REFERENCES enrollments (id) ON DELETE RESTRICT,

    -- Snapshot at issue time.
    recipient_name text        NOT NULL,
    course_title   text        NOT NULL,
    locale         text        NOT NULL DEFAULT 'kk' CHECK (locale IN ('kk', 'ru', 'en')),  -- language of the PDF
    course_hours   integer,
    final_score    integer,

    issued_at      timestamptz NOT NULL DEFAULT now(),
    issued_by_id   uuid        REFERENCES users (id) ON DELETE SET NULL,  -- NULL = issued automatically

    revoked_at     timestamptz,
    revoked_reason text,
    revoked_by_id  uuid        REFERENCES users (id) ON DELETE SET NULL,

    -- Re-issue chain: the new certificate points at the one it replaces.
    replaces_id    uuid        UNIQUE REFERENCES certificates (id) ON DELETE RESTRICT
);
CREATE INDEX certificates_enrollment_status_idx ON certificates (enrollment_id, status);
CREATE INDEX certificates_status_issued_idx ON certificates (status, issued_at);

-- +goose StatementEnd

-- +goose Down
DROP TABLE certificates, quiz_attempts, lesson_progress, enrollments, question_options, questions,
           quizzes, lessons, modules, course_instructors, courses, tracks, sessions, users;
