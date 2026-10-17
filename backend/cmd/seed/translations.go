package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Translations of the example courses live in i18n/<slug>.<lang>.json, next to the original text
// (which stays in main.go, in the course's own language). A file mirrors the course's shape and
// is matched to it by position: the Nth module, lesson, question and option translate the Nth of
// the original. Anything left out falls back to the original at read time, so a file may carry
// only titles and summaries (the short outline courses do).
//
//go:embed i18n/*.json
var translationFiles embed.FS

var translationLangs = []string{"kk", "ru", "en", "ko"}

type trOption = string

type trQuestion struct {
	Prompt      string     `json:"prompt,omitempty"`
	Explanation string     `json:"explanation,omitempty"`
	Options     []trOption `json:"options,omitempty"`
}

type trQuiz struct {
	Title     string       `json:"title,omitempty"`
	Questions []trQuestion `json:"questions,omitempty"`
}

type trLesson struct {
	Title   string `json:"title,omitempty"`
	Content string `json:"content,omitempty"`
}

type trModule struct {
	Title       string     `json:"title,omitempty"`
	Description string     `json:"description,omitempty"`
	Lessons     []trLesson `json:"lessons,omitempty"`
	Quiz        *trQuiz    `json:"quiz,omitempty"`
}

type trCourse struct {
	Title         string     `json:"title,omitempty"`
	Summary       string     `json:"summary,omitempty"`
	Description   string     `json:"description,omitempty"`
	Outcomes      []string   `json:"outcomes,omitempty"`
	Prerequisites []string   `json:"prerequisites,omitempty"`
	Modules       []trModule `json:"modules,omitempty"`
	FinalExam     *trQuiz    `json:"finalExam,omitempty"`
}

// loadTranslations reads every embedded file and checks it against the original course, so a
// translation that has drifted out of step (an extra lesson, a missing option) fails loudly
// instead of silently attaching text to the wrong row.
func loadTranslations() (map[string]map[string]*trCourse, error) {
	bySlug := map[string]course{}
	for _, c := range courses {
		bySlug[c.slug] = c
	}
	out := map[string]map[string]*trCourse{}

	entries, err := fs.ReadDir(translationFiles, "i18n")
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		name := strings.TrimSuffix(e.Name(), ".json")
		dot := strings.LastIndex(name, ".")
		if dot < 0 {
			return nil, fmt.Errorf("i18n/%s: name must be <slug>.<lang>.json", e.Name())
		}
		slug, lang := name[:dot], name[dot+1:]
		src, ok := bySlug[slug]
		if !ok {
			return nil, fmt.Errorf("i18n/%s: no course %q", e.Name(), slug)
		}
		if !contains(translationLangs, lang) || lang == src.language {
			return nil, fmt.Errorf("i18n/%s: %q is not a target language for this course (original is %s)", e.Name(), lang, src.language)
		}
		raw, err := fs.ReadFile(translationFiles, "i18n/"+e.Name())
		if err != nil {
			return nil, err
		}
		var tr trCourse
		dec := json.NewDecoder(strings.NewReader(string(raw)))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&tr); err != nil {
			return nil, fmt.Errorf("i18n/%s: %w", e.Name(), err)
		}
		if err := tr.check(src); err != nil {
			return nil, fmt.Errorf("i18n/%s: %w", e.Name(), err)
		}
		if out[slug] == nil {
			out[slug] = map[string]*trCourse{}
		}
		out[slug][lang] = &tr
	}
	return out, nil
}

func (t *trCourse) check(src course) error {
	if t.Title == "" {
		return fmt.Errorf("title is required")
	}
	if len(t.Outcomes) != 0 && len(t.Outcomes) != len(src.outcomes) {
		return fmt.Errorf("outcomes: %d, original has %d", len(t.Outcomes), len(src.outcomes))
	}
	if len(t.Prerequisites) != 0 && len(t.Prerequisites) != len(src.prerequisites) {
		return fmt.Errorf("prerequisites: %d, original has %d", len(t.Prerequisites), len(src.prerequisites))
	}
	if len(t.Modules) != 0 && len(t.Modules) != len(src.modules) {
		return fmt.Errorf("modules: %d, original has %d", len(t.Modules), len(src.modules))
	}
	for i, m := range t.Modules {
		sm := src.modules[i]
		if len(m.Lessons) != 0 && len(m.Lessons) != len(sm.lessons) {
			return fmt.Errorf("module %d: %d lessons, original has %d", i+1, len(m.Lessons), len(sm.lessons))
		}
		if m.Quiz != nil {
			if sm.quiz == nil {
				return fmt.Errorf("module %d: translation has a quiz, original has none", i+1)
			}
			if err := m.Quiz.check(sm.quiz); err != nil {
				return fmt.Errorf("module %d quiz: %w", i+1, err)
			}
		}
	}
	if t.FinalExam != nil {
		if src.finalExam == nil {
			return fmt.Errorf("translation has a final exam, original has none")
		}
		if err := t.FinalExam.check(src.finalExam); err != nil {
			return fmt.Errorf("final exam: %w", err)
		}
	}
	return nil
}

func (t *trQuiz) check(src *quiz) error {
	if len(t.Questions) != 0 && len(t.Questions) != len(src.questions) {
		return fmt.Errorf("%d questions, original has %d", len(t.Questions), len(src.questions))
	}
	for i, q := range t.Questions {
		sq := src.questions[i]
		if len(q.Options) != 0 && len(q.Options) != len(sq.options) {
			return fmt.Errorf("question %d: %d options, original has %d", i+1, len(q.Options), len(sq.options))
		}
	}
	return nil
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// applyTranslations writes the course's translations into the i18n columns. It matches rows by
// position and leaves the course alone (with a note) if the stored structure no longer has the
// shape of the seed, which happens once someone has edited the course in the app.
func applyTranslations(ctx context.Context, tx pgx.Tx, courseID string, src course, byLang map[string]*trCourse) error {
	langs := make([]string, 0, len(byLang))
	for l := range byLang {
		langs = append(langs, l)
	}
	sort.Strings(langs)

	// Reset first, so a language whose file was deleted does not linger.
	if _, err := tx.Exec(ctx, `UPDATE courses SET i18n = '{}' WHERE id = $1`, courseID); err != nil {
		return err
	}

	moduleIDs, err := ids(ctx, tx, `SELECT id FROM modules WHERE course_id = $1 ORDER BY position`, courseID)
	if err != nil {
		return err
	}
	structured := len(moduleIDs) == len(src.modules)

	for _, lang := range langs {
		tr := byLang[lang]
		if err := setI18n(ctx, tx, "courses", courseID, lang, map[string]any{
			"title": tr.Title, "summary": tr.Summary, "description": tr.Description,
			"outcomes": nilToEmpty(tr.Outcomes), "prerequisites": nilToEmpty(tr.Prerequisites),
		}, true); err != nil {
			return err
		}
		if !structured {
			continue
		}
		for mi, mid := range moduleIDs {
			sm := src.modules[mi]
			var tm trModule
			if mi < len(tr.Modules) {
				tm = tr.Modules[mi]
			}
			if err := setI18n(ctx, tx, "modules", mid, lang, map[string]any{"title": tm.Title, "description": tm.Description}, false); err != nil {
				return err
			}
			if len(tm.Lessons) > 0 {
				lessonIDs, err := ids(ctx, tx, `SELECT id FROM lessons WHERE module_id = $1 ORDER BY position`, mid)
				if err != nil {
					return err
				}
				if len(lessonIDs) == len(sm.lessons) {
					for li, lid := range lessonIDs {
						if err := setI18n(ctx, tx, "lessons", lid, lang, map[string]any{
							"title": tm.Lessons[li].Title, "content": tm.Lessons[li].Content}, false); err != nil {
							return err
						}
					}
				}
			}
			if tm.Quiz != nil {
				if err := applyQuiz(ctx, tx, `SELECT id FROM quizzes WHERE module_id = $1`, mid, lang, tm.Quiz, sm.quiz); err != nil {
					return err
				}
			}
		}
		if tr.FinalExam != nil {
			if err := applyQuiz(ctx, tx, `SELECT id FROM quizzes WHERE final_for_course_id = $1`, courseID, lang, tr.FinalExam, src.finalExam); err != nil {
				return err
			}
		}
	}
	return nil
}

func applyQuiz(ctx context.Context, tx pgx.Tx, query, owner, lang string, tr *trQuiz, src *quiz) error {
	quizIDs, err := ids(ctx, tx, query, owner)
	if err != nil || len(quizIDs) != 1 {
		return err
	}
	if err := setI18n(ctx, tx, "quizzes", quizIDs[0], lang, map[string]any{"title": tr.Title}, false); err != nil {
		return err
	}
	if len(tr.Questions) == 0 {
		return nil
	}
	questionIDs, err := ids(ctx, tx, `SELECT id FROM questions WHERE quiz_id = $1 ORDER BY position`, quizIDs[0])
	if err != nil || len(questionIDs) != len(src.questions) {
		return err
	}
	for qi, qid := range questionIDs {
		tq := tr.Questions[qi]
		if err := setI18n(ctx, tx, "questions", qid, lang, map[string]any{"prompt": tq.Prompt, "explanation": tq.Explanation}, false); err != nil {
			return err
		}
		if len(tq.Options) == 0 {
			continue
		}
		optionIDs, err := ids(ctx, tx, `SELECT id FROM question_options WHERE question_id = $1 ORDER BY position`, qid)
		if err != nil {
			return err
		}
		if len(optionIDs) != len(tq.Options) {
			continue
		}
		for oi, oid := range optionIDs {
			if err := setI18n(ctx, tx, "question_options", oid, lang, map[string]any{"text": tq.Options[oi]}, false); err != nil {
				return err
			}
		}
	}
	return nil
}

// setI18n merges one language's fields into a row's i18n column. Empty strings are dropped (the
// reader then falls back to the original); `always` keeps the language key even when every field is
// empty, which is what marks a course as available in that language.
func setI18n(ctx context.Context, tx pgx.Tx, table, id, lang string, fields map[string]any, always bool) error {
	clean := map[string]any{}
	for k, v := range fields {
		switch x := v.(type) {
		case string:
			if x != "" {
				clean[k] = x
			}
		case []string:
			if len(x) > 0 {
				clean[k] = x
			}
		}
	}
	if len(clean) == 0 && !always {
		return nil
	}
	data, err := json.Marshal(clean)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE `+table+` SET i18n = i18n || jsonb_build_object($2::text, $3::jsonb) WHERE id = $1`, id, lang, data)
	return err
}

func ids(ctx context.Context, tx pgx.Tx, query string, arg any) ([]string, error) {
	rows, err := tx.Query(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func nilToEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
