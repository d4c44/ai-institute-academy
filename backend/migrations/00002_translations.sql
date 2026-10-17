-- +goose Up
-- +goose StatementBegin

-- Course content in several languages.
--
-- The original text stays in the regular columns (title, content, ...), in the language named by
-- courses.language. Translations live next to it in an `i18n` column, keyed by language:
--   {"ru": {"title": "...", "content": "..."}, "ko": {...}}
-- Readers ask for a language and get the translation if there is one, otherwise the original.

ALTER TABLE courses          ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}';  -- title, summary, description, outcomes[], prerequisites[]
ALTER TABLE modules          ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}';  -- title, description
ALTER TABLE lessons          ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}';  -- title, content
ALTER TABLE quizzes          ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}';  -- title
ALTER TABLE questions        ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}';  -- prompt, explanation
ALTER TABLE question_options ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}';  -- text

-- Translated string, falling back to the original when the language or the field is missing.
CREATE FUNCTION i18n_text(i18n jsonb, lang text, field text, fallback text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT COALESCE(NULLIF(i18n #>> ARRAY[lang, field], ''), fallback)
$$;

-- Same for a list of strings (learning outcomes, prerequisites).
CREATE FUNCTION i18n_texts(i18n jsonb, lang text, field text, fallback text[]) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN jsonb_typeof(i18n -> lang -> field) = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(i18n -> lang -> field))
                ELSE fallback END
$$;

-- The language a reader actually gets: the requested one if a translation exists, else the original.
CREATE FUNCTION i18n_lang(i18n jsonb, lang text, original text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN jsonb_exists(i18n, lang) THEN lang ELSE original END
$$;

-- Korean joins Kazakh, Russian and English as an interface and certificate language.
ALTER TABLE users        DROP CONSTRAINT users_locale_check;
ALTER TABLE users        ADD  CONSTRAINT users_locale_check CHECK (locale IN ('kk', 'ru', 'en', 'ko'));
ALTER TABLE certificates DROP CONSTRAINT certificates_locale_check;
ALTER TABLE certificates ADD  CONSTRAINT certificates_locale_check CHECK (locale IN ('kk', 'ru', 'en', 'ko'));

-- +goose StatementEnd

-- +goose Down
ALTER TABLE certificates DROP CONSTRAINT certificates_locale_check;
ALTER TABLE certificates ADD  CONSTRAINT certificates_locale_check CHECK (locale IN ('kk', 'ru', 'en'));
ALTER TABLE users        DROP CONSTRAINT users_locale_check;
ALTER TABLE users        ADD  CONSTRAINT users_locale_check CHECK (locale IN ('kk', 'ru', 'en'));
DROP FUNCTION i18n_lang(jsonb, text, text);
DROP FUNCTION i18n_texts(jsonb, text, text, text[]);
DROP FUNCTION i18n_text(jsonb, text, text, text);
ALTER TABLE question_options DROP COLUMN i18n;
ALTER TABLE questions        DROP COLUMN i18n;
ALTER TABLE quizzes          DROP COLUMN i18n;
ALTER TABLE lessons          DROP COLUMN i18n;
ALTER TABLE modules          DROP COLUMN i18n;
ALTER TABLE courses          DROP COLUMN i18n;
