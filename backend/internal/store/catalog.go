package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ─── Types (JSON shapes are the public API) ──────────────────────────────────

type Track struct {
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	CourseCount int     `json:"courseCount"`
}

type TrackRef struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

type CourseSummary struct {
	Slug           string    `json:"slug"`
	Title          string    `json:"title"`
	Summary        string    `json:"summary"`
	Level          string    `json:"level"`
	Language       string    `json:"language"`
	EstimatedHours *int      `json:"estimatedHours"`
	ModuleCount    int       `json:"moduleCount"`
	LearnerCount   int       `json:"learnerCount"`
	Track          *TrackRef `json:"track"`
	// Languages the course can be read in: the original plus every translation.
	Languages []string `json:"languages"`
}

type CourseList struct {
	Items []CourseSummary `json:"items"`
	Total int             `json:"total"`
}

type Instructor struct {
	Name     string  `json:"name"`
	Headline *string `json:"headline"`
	Bio      *string `json:"bio"`
	IsLead   bool    `json:"isLead"`
}

type LessonOutline struct {
	Title       string `json:"title"`
	Type        string `json:"type"`
	DurationSec *int   `json:"durationSec"`
	IsPreview   bool   `json:"isPreview"`
}

type ModuleOutline struct {
	Title       string          `json:"title"`
	Description *string         `json:"description"`
	HasQuiz     bool            `json:"hasQuiz"`
	Lessons     []LessonOutline `json:"lessons"`
}

type CourseDetail struct {
	CourseSummary
	Description      string          `json:"description"`
	LearningOutcomes []string        `json:"learningOutcomes"`
	Prerequisites    []string        `json:"prerequisites"`
	Sequential       bool            `json:"sequential"`
	HasFinalExam     bool            `json:"hasFinalExam"`
	PublishedAt      *time.Time      `json:"publishedAt"`
	Instructors      []Instructor    `json:"instructors"`
	Modules          []ModuleOutline `json:"modules"`
}

type Stats struct {
	Courses   int `json:"courses"`
	Tracks    int `json:"tracks"`
	Languages int `json:"languages"`
	Learners  int `json:"learners"`
}

type CourseFilter struct {
	Track    string
	Level    string
	Language string
	Query    string
	Sort     string // "popular" (default) | "new"
	Limit    int
	Offset   int
}

var ErrNotFound = errors.New("not found")

// ─── Queries ─────────────────────────────────────────────────────────────────

func (s *Store) Stats(ctx context.Context) (Stats, error) {
	var st Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM courses WHERE status = 'PUBLISHED'),
		  (SELECT count(DISTINCT track_id) FROM courses WHERE status = 'PUBLISHED' AND track_id IS NOT NULL),
		  (SELECT count(*) FROM (
		     SELECT language FROM courses WHERE status = 'PUBLISHED'
		     UNION SELECT jsonb_object_keys(i18n) FROM courses WHERE status = 'PUBLISHED') l),
		  (SELECT count(DISTINCT user_id) FROM enrollments WHERE status <> 'DROPPED')
	`).Scan(&st.Courses, &st.Tracks, &st.Languages, &st.Learners)
	return st, err
}

func (s *Store) Tracks(ctx context.Context) ([]Track, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t.slug, t.name, t.description,
		       count(c.id) FILTER (WHERE c.status = 'PUBLISHED')
		FROM tracks t
		LEFT JOIN courses c ON c.track_id = t.id
		GROUP BY t.id
		ORDER BY t.position, t.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Track{}
	for rows.Next() {
		var t Track
		if err := rows.Scan(&t.Slug, &t.Name, &t.Description, &t.CourseCount); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Expects the requested language as $2. Title, summary and language come back translated when a
// translation exists; `language` is the language of the text actually returned.
const courseSummaryColumns = `
	c.slug, i18n_text(c.i18n, $2, 'title', c.title), i18n_text(c.i18n, $2, 'summary', c.summary), c.level,
	i18n_lang(c.i18n, $2, c.language), c.estimated_hours,
	(SELECT count(*) FROM modules m WHERE m.course_id = c.id),
	(SELECT count(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'DROPPED'),
	t.slug, t.name,
	ARRAY[c.language] || ARRAY(SELECT jsonb_object_keys(c.i18n))`

func scanCourseSummary(row pgx.Row, extra ...any) (CourseSummary, error) {
	var (
		c         CourseSummary
		trackSlug *string
		trackName *string
	)
	dest := append([]any{
		&c.Slug, &c.Title, &c.Summary, &c.Level, &c.Language, &c.EstimatedHours,
		&c.ModuleCount, &c.LearnerCount, &trackSlug, &trackName, &c.Languages,
	}, extra...)
	if err := row.Scan(dest...); err != nil {
		return c, err
	}
	if trackSlug != nil && trackName != nil {
		c.Track = &TrackRef{Slug: *trackSlug, Name: *trackName}
	}
	return c, nil
}

// likePattern escapes LIKE wildcards so user input is matched literally.
func likePattern(q string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(q) + "%"
}

func (s *Store) Courses(ctx context.Context, f CourseFilter) (CourseList, error) {
	// ORDER BY comes from a fixed whitelist, never from user input.
	order := "learners DESC, c.published_at DESC NULLS LAST, c.title"
	if f.Sort == "new" {
		order = "c.published_at DESC NULLS LAST, c.title"
	}
	if f.Limit <= 0 || f.Limit > 60 {
		f.Limit = 24
	}
	if f.Offset < 0 {
		f.Offset = 0
	}
	pattern := ""
	if f.Query != "" {
		pattern = likePattern(f.Query)
	}

	rows, err := s.pool.Query(ctx, `
		WITH counted AS (
		  SELECT c.*, t.slug AS track_slug, t.name AS track_name,
		         (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'DROPPED') AS learners
		  FROM courses c
		  LEFT JOIN tracks t ON t.id = c.track_id
		  WHERE c.status = 'PUBLISHED'
		    AND ($1 = '' OR t.slug = $1)
		    AND ($2 = '' OR c.level = $2)
		    AND ($3 = '' OR c.language = $3 OR jsonb_exists(c.i18n, $3))
		    AND ($4 = '' OR c.title ILIKE $4 OR c.summary ILIKE $4
		         OR i18n_text(c.i18n, $7, 'title', c.title) ILIKE $4
		         OR i18n_text(c.i18n, $7, 'summary', c.summary) ILIKE $4)
		)
		SELECT c.slug, i18n_text(c.i18n, $7, 'title', c.title), i18n_text(c.i18n, $7, 'summary', c.summary), c.level,
		       i18n_lang(c.i18n, $7, c.language), c.estimated_hours,
		       (SELECT count(*) FROM modules m WHERE m.course_id = c.id),
		       c.learners, c.track_slug, c.track_name,
		       ARRAY[c.language] || ARRAY(SELECT jsonb_object_keys(c.i18n)),
		       count(*) OVER ()
		FROM counted c
		ORDER BY `+order+`
		LIMIT $5 OFFSET $6`,
		f.Track, f.Level, f.Language, pattern, f.Limit, f.Offset, langOf(ctx))
	if err != nil {
		return CourseList{}, err
	}
	defer rows.Close()

	list := CourseList{Items: []CourseSummary{}}
	for rows.Next() {
		var total int
		c, err := scanCourseSummary(rows, &total)
		if err != nil {
			return CourseList{}, err
		}
		list.Total = total
		list.Items = append(list.Items, c)
	}
	return list, rows.Err()
}

func (s *Store) Course(ctx context.Context, slug string) (CourseDetail, error) {
	var (
		d        CourseDetail
		courseID string
	)
	row := s.pool.QueryRow(ctx, `
		SELECT `+courseSummaryColumns+`,
		       c.id, i18n_text(c.i18n, $2, 'description', c.description),
		       i18n_texts(c.i18n, $2, 'outcomes', c.learning_outcomes),
		       i18n_texts(c.i18n, $2, 'prerequisites', c.prerequisites),
		       c.sequential, c.published_at,
		       EXISTS (SELECT 1 FROM quizzes q WHERE q.final_for_course_id = c.id)
		FROM courses c
		LEFT JOIN tracks t ON t.id = c.track_id
		WHERE c.slug = $1 AND c.status = 'PUBLISHED'`, slug, langOf(ctx))

	summary, err := scanCourseSummary(row,
		&courseID, &d.Description, &d.LearningOutcomes, &d.Prerequisites, &d.Sequential,
		&d.PublishedAt, &d.HasFinalExam)
	if errors.Is(err, pgx.ErrNoRows) {
		return d, ErrNotFound
	}
	if err != nil {
		return d, err
	}
	d.CourseSummary = summary

	if d.Instructors, err = s.instructors(ctx, courseID); err != nil {
		return d, err
	}
	if d.Modules, err = s.outline(ctx, courseID); err != nil {
		return d, err
	}
	return d, nil
}

func (s *Store) instructors(ctx context.Context, courseID string) ([]Instructor, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.full_name, u.headline, u.bio, ci.is_lead
		FROM course_instructors ci
		JOIN users u ON u.id = ci.user_id
		WHERE ci.course_id = $1
		ORDER BY ci.is_lead DESC, u.full_name`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Instructor{}
	for rows.Next() {
		var i Instructor
		if err := rows.Scan(&i.Name, &i.Headline, &i.Bio, &i.IsLead); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

func (s *Store) outline(ctx context.Context, courseID string) ([]ModuleOutline, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT m.id, i18n_text(m.i18n, $2, 'title', m.title),
		       NULLIF(i18n_text(m.i18n, $2, 'description', COALESCE(m.description, '')), ''),
		       EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = m.id),
		       i18n_text(l.i18n, $2, 'title', l.title), l.type, l.duration_sec, l.is_preview
		FROM modules m
		LEFT JOIN lessons l ON l.module_id = m.id
		WHERE m.course_id = $1
		ORDER BY m.position, l.position`, courseID, langOf(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ModuleOutline{}
	var lastID string
	for rows.Next() {
		var (
			id      string
			m       ModuleOutline
			title   *string
			typ     *string
			dur     *int
			preview *bool
		)
		if err := rows.Scan(&id, &m.Title, &m.Description, &m.HasQuiz, &title, &typ, &dur, &preview); err != nil {
			return nil, err
		}
		if id != lastID {
			m.Lessons = []LessonOutline{}
			out = append(out, m)
			lastID = id
		}
		if title != nil {
			cur := &out[len(out)-1]
			cur.Lessons = append(cur.Lessons, LessonOutline{
				Title: *title, Type: *typ, DurationSec: dur, IsPreview: preview != nil && *preview,
			})
		}
	}
	return out, rows.Err()
}
