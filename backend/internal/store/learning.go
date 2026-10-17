package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	// ErrLocked: the unit exists but the student hasn't unlocked it yet.
	ErrLocked = errors.New("locked")
	// ErrNoAttempts: the quiz's attempt limit is used up.
	ErrNoAttempts = errors.New("no attempts left")
)

// ─── Progress view ───────────────────────────────────────────────────────────

type LessonState struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Type        string `json:"type"`
	DurationSec *int   `json:"durationSec"`
	Completed   bool   `json:"completed"`
}

type QuizState struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	PassingScore int    `json:"passingScore"`
	MaxAttempts  *int   `json:"maxAttempts"`
	AttemptsUsed int    `json:"attemptsUsed"`
	BestScore    *int   `json:"bestScore"`
	Passed       bool   `json:"passed"`
	Available    bool   `json:"available"` // all lessons of the module done (or all modules, for the final)
	Locked       bool   `json:"locked"`    // the module itself is still locked
}

type ModuleState struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description *string       `json:"description"`
	Locked      bool          `json:"locked"`
	Completed   bool          `json:"completed"`
	Lessons     []LessonState `json:"lessons"`
	Quiz        *QuizState    `json:"quiz"`
}

type NextUnit struct {
	Kind string `json:"kind"` // "lesson" | "quiz" | "final"
	ID   string `json:"id"`
}

type CertificateRef struct {
	Code     string    `json:"code"`
	Status   string    `json:"status"`
	IssuedAt time.Time `json:"issuedAt"`
}

type CourseProgress struct {
	CourseID        string          `json:"-"`
	Slug            string          `json:"slug"`
	Title           string          `json:"title"`
	Language        string          `json:"language"`
	EstimatedHours  *int            `json:"estimatedHours"`
	Sequential      bool            `json:"sequential"`
	Status          string          `json:"status"` // enrollment status
	ProgressPercent int             `json:"progressPercent"`
	CompletedUnits  int             `json:"completedUnits"`
	TotalUnits      int             `json:"totalUnits"`
	Modules         []ModuleState   `json:"modules"`
	FinalExam       *QuizState      `json:"finalExam"`
	Next            *NextUnit       `json:"next"`
	Certificate     *CertificateRef `json:"certificate"`
}

// CourseProgress builds the learning view of a course for an enrolled student: which modules are
// unlocked, which quizzes are available, how far along they are and what to do next.
// Nothing here is stored; it is derived from lesson_progress and quiz_attempts.
func (s *Store) CourseProgress(ctx context.Context, userID, slug string) (CourseProgress, error) {
	var cp CourseProgress
	err := s.pool.QueryRow(ctx, `
		SELECT c.id, c.slug, i18n_text(c.i18n, $3, 'title', c.title), i18n_lang(c.i18n, $3, c.language),
		       c.estimated_hours, c.sequential, e.status
		FROM courses c
		JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1 AND e.status <> 'DROPPED'
		WHERE c.slug = $2 AND c.status = 'PUBLISHED'`, userID, slug, langOf(ctx),
	).Scan(&cp.CourseID, &cp.Slug, &cp.Title, &cp.Language, &cp.EstimatedHours, &cp.Sequential, &cp.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return cp, ErrNotFound
	}
	if err != nil {
		return cp, err
	}

	// Modules and lessons, with this student's completion.
	rows, err := s.pool.Query(ctx, `
		SELECT m.id, i18n_text(m.i18n, $3, 'title', m.title),
		       NULLIF(i18n_text(m.i18n, $3, 'description', COALESCE(m.description, '')), ''),
		       l.id, i18n_text(l.i18n, $3, 'title', l.title), l.type, l.duration_sec, (lp.completed_at IS NOT NULL)
		FROM modules m
		LEFT JOIN lessons l ON l.module_id = m.id
		LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
		WHERE m.course_id = $2
		ORDER BY m.position, l.position`, userID, cp.CourseID, langOf(ctx))
	if err != nil {
		return cp, err
	}
	defer rows.Close()

	byModule := map[string]int{}
	for rows.Next() {
		var (
			mID, mTitle string
			mDesc       *string
			lID, lTitle *string
			lType       *string
			lDur        *int
			lDone       *bool
		)
		if err := rows.Scan(&mID, &mTitle, &mDesc, &lID, &lTitle, &lType, &lDur, &lDone); err != nil {
			return cp, err
		}
		idx, ok := byModule[mID]
		if !ok {
			cp.Modules = append(cp.Modules, ModuleState{ID: mID, Title: mTitle, Description: mDesc, Lessons: []LessonState{}})
			idx = len(cp.Modules) - 1
			byModule[mID] = idx
		}
		if lID != nil {
			cp.Modules[idx].Lessons = append(cp.Modules[idx].Lessons, LessonState{
				ID: *lID, Title: *lTitle, Type: *lType, DurationSec: lDur, Completed: lDone != nil && *lDone,
			})
		}
	}
	if err := rows.Err(); err != nil {
		return cp, err
	}
	rows.Close()

	// Quizzes (module quizzes and the final exam) with this student's attempts.
	qrows, err := s.pool.Query(ctx, `
		SELECT q.id, q.module_id, q.final_for_course_id, i18n_text(q.i18n, $3, 'title', q.title), q.passing_score, q.max_attempts,
		       count(a.id) FILTER (WHERE a.submitted_at IS NOT NULL),
		       max(a.score), COALESCE(bool_or(a.passed), false)
		FROM quizzes q
		LEFT JOIN quiz_attempts a ON a.quiz_id = q.id AND a.user_id = $1
		WHERE q.final_for_course_id = $2
		   OR q.module_id IN (SELECT id FROM modules WHERE course_id = $2)
		GROUP BY q.id`, userID, cp.CourseID, langOf(ctx))
	if err != nil {
		return cp, err
	}
	defer qrows.Close()

	for qrows.Next() {
		var (
			q               QuizState
			moduleID, final *string
		)
		if err := qrows.Scan(&q.ID, &moduleID, &final, &q.Title, &q.PassingScore, &q.MaxAttempts,
			&q.AttemptsUsed, &q.BestScore, &q.Passed); err != nil {
			return cp, err
		}
		if moduleID != nil {
			if idx, ok := byModule[*moduleID]; ok {
				qq := q
				cp.Modules[idx].Quiz = &qq
			}
		} else {
			qq := q
			cp.FinalExam = &qq
		}
	}
	if err := qrows.Err(); err != nil {
		return cp, err
	}
	qrows.Close()

	// Derive locks, availability, progress and the next unit.
	prevDone := true
	total, done := 0, 0
	for i := range cp.Modules {
		m := &cp.Modules[i]
		m.Locked = cp.Sequential && !prevDone

		lessonsDone := true
		for _, l := range m.Lessons {
			total++
			if l.Completed {
				done++
			} else {
				lessonsDone = false
			}
		}
		if m.Quiz != nil {
			total++
			m.Quiz.Locked = m.Locked
			m.Quiz.Available = !m.Locked && lessonsDone
			if m.Quiz.Passed {
				done++
			}
		}
		m.Completed = lessonsDone && (m.Quiz == nil || m.Quiz.Passed)
		prevDone = m.Completed

		if cp.Next == nil && !m.Locked && !m.Completed {
			if !lessonsDone {
				for _, l := range m.Lessons {
					if !l.Completed {
						cp.Next = &NextUnit{Kind: "lesson", ID: l.ID}
						break
					}
				}
			} else if m.Quiz != nil {
				cp.Next = &NextUnit{Kind: "quiz", ID: m.Quiz.ID}
			}
		}
	}
	if cp.FinalExam != nil {
		total++
		allModulesDone := true
		for _, m := range cp.Modules {
			if !m.Completed {
				allModulesDone = false
			}
		}
		cp.FinalExam.Locked = cp.Sequential && !allModulesDone
		cp.FinalExam.Available = allModulesDone
		if cp.FinalExam.Passed {
			done++
		}
		if cp.Next == nil && allModulesDone && !cp.FinalExam.Passed {
			cp.Next = &NextUnit{Kind: "final", ID: cp.FinalExam.ID}
		}
	}
	cp.TotalUnits, cp.CompletedUnits = total, done
	if total > 0 {
		cp.ProgressPercent = done * 100 / total
	}

	var ref CertificateRef
	err = s.pool.QueryRow(ctx, `
		SELECT ce.code, ce.status, ce.issued_at
		FROM certificates ce
		JOIN enrollments e ON e.id = ce.enrollment_id
		WHERE e.user_id = $1 AND e.course_id = $2
		ORDER BY (ce.status = 'VALID') DESC, ce.issued_at DESC
		LIMIT 1`, userID, cp.CourseID).Scan(&ref.Code, &ref.Status, &ref.IssuedAt)
	if err == nil {
		cp.Certificate = &ref
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return cp, err
	}

	// Touch the enrollment so "continue where you left off" can be ordered by recency.
	_, _ = s.pool.Exec(ctx, `UPDATE enrollments SET last_accessed_at = now() WHERE user_id = $1 AND course_id = $2`,
		userID, cp.CourseID)
	return cp, nil
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

type LessonDetail struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Type        string    `json:"type"`
	Content     *string   `json:"content"`
	VideoURL    *string   `json:"videoUrl"`
	DurationSec *int      `json:"durationSec"`
	Completed   bool      `json:"completed"`
	ModuleTitle string    `json:"moduleTitle"`
	CourseSlug  string    `json:"courseSlug"`
	CourseTitle string    `json:"courseTitle"`
	Language    string    `json:"language"`
	Next        *NextUnit `json:"next"`
}

// lessonCourse returns the slug of the course a lesson belongs to.
func (s *Store) lessonCourse(ctx context.Context, lessonID string) (string, error) {
	var slug string
	err := s.pool.QueryRow(ctx, `
		SELECT c.slug FROM lessons l
		JOIN modules m ON m.id = l.module_id
		JOIN courses c ON c.id = m.course_id
		WHERE l.id = $1`, lessonID).Scan(&slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return slug, err
}

// unitAfter finds the unit that follows the given lesson or quiz in the course's reading order.
func unitAfter(cp CourseProgress, kind, id string) *NextUnit {
	var order []NextUnit
	for _, m := range cp.Modules {
		for _, l := range m.Lessons {
			order = append(order, NextUnit{Kind: "lesson", ID: l.ID})
		}
		if m.Quiz != nil {
			order = append(order, NextUnit{Kind: "quiz", ID: m.Quiz.ID})
		}
	}
	if cp.FinalExam != nil {
		order = append(order, NextUnit{Kind: "final", ID: cp.FinalExam.ID})
	}
	for i, u := range order {
		isCurrent := u.ID == id && (u.Kind == kind || (kind == "quiz" && u.Kind == "final"))
		if isCurrent && i+1 < len(order) {
			n := order[i+1]
			return &n
		}
	}
	return nil
}

func (s *Store) Lesson(ctx context.Context, userID, lessonID string) (LessonDetail, error) {
	var d LessonDetail
	slug, err := s.lessonCourse(ctx, lessonID)
	if err != nil {
		return d, err
	}
	cp, err := s.CourseProgress(ctx, userID, slug)
	if err != nil {
		return d, err // ErrNotFound when the student isn't enrolled
	}
	for _, m := range cp.Modules {
		for _, l := range m.Lessons {
			if l.ID != lessonID {
				continue
			}
			if m.Locked {
				return d, ErrLocked
			}
			err := s.pool.QueryRow(ctx, `SELECT NULLIF(i18n_text(i18n, $2, 'content', COALESCE(content, '')), ''), video_url FROM lessons WHERE id = $1`, lessonID, langOf(ctx)).
				Scan(&d.Content, &d.VideoURL)
			if err != nil {
				return d, err
			}
			d.ID, d.Title, d.Type, d.DurationSec, d.Completed = l.ID, l.Title, l.Type, l.DurationSec, l.Completed
			d.ModuleTitle, d.CourseSlug, d.CourseTitle, d.Language = m.Title, cp.Slug, cp.Title, cp.Language
			d.Next = unitAfter(cp, "lesson", lessonID)
			return d, nil
		}
	}
	return d, ErrNotFound
}

type CompletionResult struct {
	Progress    CourseProgress  `json:"progress"`
	Next        *NextUnit       `json:"next"`
	Certificate *CertificateRef `json:"certificate"`
}

// CompleteLesson marks a lesson done (idempotent) and issues the certificate if that was the last requirement.
func (s *Store) CompleteLesson(ctx context.Context, userID, lessonID string) (CompletionResult, error) {
	var res CompletionResult
	d, err := s.Lesson(ctx, userID, lessonID) // enforces enrollment and unlock
	if err != nil {
		return res, err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO lesson_progress (user_id, lesson_id, completed_at)
		VALUES ($1, $2, now())
		ON CONFLICT (user_id, lesson_id) DO UPDATE
		  SET completed_at = COALESCE(lesson_progress.completed_at, now()), updated_at = now()`,
		userID, lessonID)
	if err != nil {
		return res, err
	}
	return s.afterProgress(ctx, userID, d.CourseSlug, "lesson", lessonID)
}

func (s *Store) afterProgress(ctx context.Context, userID, slug, kind, id string) (CompletionResult, error) {
	var res CompletionResult
	cp, err := s.CourseProgress(ctx, userID, slug)
	if err != nil {
		return res, err
	}
	if _, err := s.IssueCertificateIfEligible(ctx, userID, cp.CourseID); err != nil {
		return res, err
	}
	// Re-read so the response reflects completion and the new certificate.
	if cp, err = s.CourseProgress(ctx, userID, slug); err != nil {
		return res, err
	}
	res.Progress = cp
	res.Next = unitAfter(cp, kind, id)
	res.Certificate = cp.Certificate
	return res, nil
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

type QuizOption struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type QuizQuestion struct {
	ID      string       `json:"id"`
	Type    string       `json:"type"`
	Prompt  string       `json:"prompt"`
	Points  int          `json:"points"`
	Options []QuizOption `json:"options"`
}

type QuizDetail struct {
	ID           string         `json:"id"`
	Title        string         `json:"title"`
	IsFinal      bool           `json:"isFinal"`
	PassingScore int            `json:"passingScore"`
	MaxAttempts  *int           `json:"maxAttempts"`
	AttemptsUsed int            `json:"attemptsUsed"`
	BestScore    *int           `json:"bestScore"`
	Passed       bool           `json:"passed"`
	ModuleTitle  *string        `json:"moduleTitle"`
	CourseSlug   string         `json:"courseSlug"`
	CourseTitle  string         `json:"courseTitle"`
	Language     string         `json:"language"`
	Questions    []QuizQuestion `json:"questions"`
}

// quizAccess resolves the course of a quiz and checks that the student may take it now.
func (s *Store) quizAccess(ctx context.Context, userID, quizID string) (CourseProgress, QuizState, *string, bool, error) {
	var (
		cp      CourseProgress
		slug    string
		modName *string
		isFinal bool
	)
	err := s.pool.QueryRow(ctx, `
		SELECT c.slug, i18n_text(m.i18n, $2, 'title', m.title), (q.final_for_course_id IS NOT NULL)
		FROM quizzes q
		LEFT JOIN modules m ON m.id = q.module_id
		JOIN courses c ON c.id = COALESCE(q.final_for_course_id, m.course_id)
		WHERE q.id = $1`, quizID, langOf(ctx)).Scan(&slug, &modName, &isFinal)
	if errors.Is(err, pgx.ErrNoRows) {
		return cp, QuizState{}, nil, false, ErrNotFound
	}
	if err != nil {
		return cp, QuizState{}, nil, false, err
	}
	cp, err = s.CourseProgress(ctx, userID, slug)
	if err != nil {
		return cp, QuizState{}, nil, false, err
	}
	var state *QuizState
	if isFinal {
		state = cp.FinalExam
	} else {
		for _, m := range cp.Modules {
			if m.Quiz != nil && m.Quiz.ID == quizID {
				state = m.Quiz
			}
		}
	}
	if state == nil {
		return cp, QuizState{}, nil, false, ErrNotFound
	}
	if !state.Available {
		return cp, *state, modName, isFinal, ErrLocked
	}
	return cp, *state, modName, isFinal, nil
}

// Quiz returns the questions of a quiz the student may take. Correct answers are never included.
func (s *Store) Quiz(ctx context.Context, userID, quizID string) (QuizDetail, error) {
	var d QuizDetail
	cp, state, modName, isFinal, err := s.quizAccess(ctx, userID, quizID)
	if err != nil {
		return d, err
	}
	d = QuizDetail{
		ID: state.ID, Title: state.Title, IsFinal: isFinal, PassingScore: state.PassingScore,
		MaxAttempts: state.MaxAttempts, AttemptsUsed: state.AttemptsUsed, BestScore: state.BestScore,
		Passed: state.Passed, ModuleTitle: modName, CourseSlug: cp.Slug, CourseTitle: cp.Title,
		Language: cp.Language, Questions: []QuizQuestion{},
	}

	rows, err := s.pool.Query(ctx, `
		SELECT q.id, q.type, i18n_text(q.i18n, $2, 'prompt', q.prompt), q.points, o.id, i18n_text(o.i18n, $2, 'text', o.text)
		FROM questions q
		JOIN question_options o ON o.question_id = q.id
		WHERE q.quiz_id = $1
		ORDER BY q.position, o.position`, quizID, langOf(ctx))
	if err != nil {
		return d, err
	}
	defer rows.Close()

	idx := map[string]int{}
	for rows.Next() {
		var q QuizQuestion
		var o QuizOption
		if err := rows.Scan(&q.ID, &q.Type, &q.Prompt, &q.Points, &o.ID, &o.Text); err != nil {
			return d, err
		}
		i, ok := idx[q.ID]
		if !ok {
			q.Options = []QuizOption{}
			d.Questions = append(d.Questions, q)
			i = len(d.Questions) - 1
			idx[q.ID] = i
		}
		d.Questions[i].Options = append(d.Questions[i].Options, o)
	}
	return d, rows.Err()
}

type QuestionResult struct {
	QuestionID  string  `json:"questionId"`
	Correct     bool    `json:"correct"`
	Explanation *string `json:"explanation"`
}

type QuizResult struct {
	Score        int              `json:"score"`
	Passed       bool             `json:"passed"`
	PassingScore int              `json:"passingScore"`
	CorrectCount int              `json:"correctCount"`
	Total        int              `json:"total"`
	AttemptsUsed int              `json:"attemptsUsed"`
	MaxAttempts  *int             `json:"maxAttempts"`
	Results      []QuestionResult `json:"results"`
	Next         *NextUnit        `json:"next"`
	Certificate  *CertificateRef  `json:"certificate"`
	CourseSlug   string           `json:"courseSlug"`
}

// SubmitQuiz grades an attempt on the server, stores it, and issues the certificate when this pass
// completes the course. answers maps question id -> selected option ids.
func (s *Store) SubmitQuiz(ctx context.Context, userID, quizID string, answers map[string][]string) (QuizResult, error) {
	var res QuizResult
	cp, state, _, isFinal, err := s.quizAccess(ctx, userID, quizID)
	if err != nil {
		return res, err
	}
	if state.MaxAttempts != nil && state.AttemptsUsed >= *state.MaxAttempts {
		return res, ErrNoAttempts
	}

	rows, err := s.pool.Query(ctx, `
		SELECT q.id, q.points, q.type, NULLIF(i18n_text(q.i18n, $2, 'explanation', COALESCE(q.explanation, '')), ''), o.id, o.is_correct
		FROM questions q
		JOIN question_options o ON o.question_id = q.id
		WHERE q.quiz_id = $1
		ORDER BY q.position, o.position`, quizID, langOf(ctx))
	if err != nil {
		return res, err
	}
	defer rows.Close()

	type question struct {
		points      int
		typ         string
		explanation *string
		correct     map[string]bool
		valid       map[string]bool
	}
	var order []string
	qs := map[string]*question{}
	for rows.Next() {
		var (
			qid, typ, oid string
			points        int
			expl          *string
			isCorrect     bool
		)
		if err := rows.Scan(&qid, &points, &typ, &expl, &oid, &isCorrect); err != nil {
			return res, err
		}
		q, ok := qs[qid]
		if !ok {
			q = &question{points: points, typ: typ, explanation: expl, correct: map[string]bool{}, valid: map[string]bool{}}
			qs[qid] = q
			order = append(order, qid)
		}
		q.valid[oid] = true
		if isCorrect {
			q.correct[oid] = true
		}
	}
	if err := rows.Err(); err != nil {
		return res, err
	}
	rows.Close()
	if len(order) == 0 {
		return res, ErrNotFound
	}

	earned, possible := 0, 0
	for _, qid := range order {
		q := qs[qid]
		possible += q.points

		picked := map[string]bool{}
		for _, id := range answers[qid] {
			if q.valid[id] {
				picked[id] = true
			}
		}
		ok := len(picked) == len(q.correct) && len(picked) > 0
		for id := range picked {
			if !q.correct[id] {
				ok = false
			}
		}
		if q.typ != "MULTIPLE_CHOICE" && len(picked) > 1 {
			ok = false
		}
		if ok {
			earned += q.points
			res.CorrectCount++
		}
		res.Results = append(res.Results, QuestionResult{QuestionID: qid, Correct: ok, Explanation: q.explanation})
	}
	res.Total = len(order)
	res.Score = earned * 100 / possible
	res.PassingScore = state.PassingScore
	res.Passed = res.Score >= state.PassingScore
	res.MaxAttempts = state.MaxAttempts
	res.AttemptsUsed = state.AttemptsUsed + 1
	res.CourseSlug = cp.Slug

	stored, _ := json.Marshal(answers)
	if _, err := s.pool.Exec(ctx, `
		INSERT INTO quiz_attempts (user_id, quiz_id, answers, score, passed, submitted_at)
		VALUES ($1, $2, $3, $4, $5, now())`,
		userID, quizID, stored, res.Score, res.Passed); err != nil {
		return res, err
	}

	kind := "quiz"
	if isFinal {
		kind = "final"
	}
	after, err := s.afterProgress(ctx, userID, cp.Slug, kind, quizID)
	if err != nil {
		return res, err
	}
	if res.Passed {
		res.Next = after.Next
	}
	res.Certificate = after.Certificate
	return res, nil
}
