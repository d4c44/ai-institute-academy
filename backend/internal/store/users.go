package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrLoginTaken = errors.New("login already taken")
	ErrEmailTaken = errors.New("email already taken")
)

type User struct {
	ID         string    `json:"id"`
	Login      string    `json:"login"`
	FullName   string    `json:"fullName"`
	Email      *string   `json:"email"`
	CourseYear *int      `json:"courseYear"`
	Role       string    `json:"role"`
	Locale     string    `json:"locale"`
	CreatedAt  time.Time `json:"createdAt"`
}

const userColumns = `u.id, u.login, u.full_name, u.email, u.course_year, u.role, u.locale, u.created_at`

func scanUser(row pgx.Row, extra ...any) (User, error) {
	var u User
	var year *int16
	dest := append([]any{&u.ID, &u.Login, &u.FullName, &u.Email, &year, &u.Role, &u.Locale, &u.CreatedAt}, extra...)
	if err := row.Scan(dest...); err != nil {
		return u, err
	}
	if year != nil {
		y := int(*year)
		u.CourseYear = &y
	}
	return u, nil
}

// mapUniqueViolation turns a unique-index violation on users into a typed error.
func mapUniqueViolation(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		switch pg.ConstraintName {
		case "users_login_key":
			return ErrLoginTaken
		case "users_email_key":
			return ErrEmailTaken
		}
	}
	return err
}

type NewUser struct {
	Login        string
	FullName     string
	Email        *string
	CourseYear   *int
	PasswordHash string
	Locale       string
}

// CreateUser inserts a STUDENT. Roles above that are granted by an admin, never at sign-up.
func (s *Store) CreateUser(ctx context.Context, in NewUser) (User, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO users AS u (login, full_name, email, course_year, password_hash, locale)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+userColumns,
		in.Login, in.FullName, in.Email, in.CourseYear, in.PasswordHash, in.Locale)
	u, err := scanUser(row)
	return u, mapUniqueViolation(err)
}

// UserForLogin finds an account by login or email (case-insensitive) and returns its password hash.
func (s *Store) UserForLogin(ctx context.Context, identifier string) (User, string, error) {
	var hash string
	row := s.pool.QueryRow(ctx, `
		SELECT `+userColumns+`, u.password_hash
		FROM users u
		WHERE lower(u.login) = lower($1) OR lower(u.email) = lower($1)
		LIMIT 1`, identifier)
	u, err := scanUser(row, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, "", ErrNotFound
	}
	return u, hash, err
}

func (s *Store) CreateSession(ctx context.Context, userID string, tokenHash []byte, expires time.Time, ip, userAgent string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))`,
		userID, tokenHash, expires, ip, truncate(userAgent, 300))
	return err
}

func (s *Store) UserBySession(ctx context.Context, tokenHash []byte) (User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+userColumns+`
		FROM sessions se
		JOIN users u ON u.id = se.user_id
		WHERE se.token_hash = $1 AND se.expires_at > now()`, tokenHash)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return err
}

// PurgeExpiredSessions removes sessions past their expiry. Cheap enough to run on every login.
func (s *Store) PurgeExpiredSessions(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at < now()`)
	return err
}

type ProfileUpdate struct {
	FullName   string
	CourseYear *int
	Email      *string
}

func (s *Store) UpdateProfile(ctx context.Context, userID string, in ProfileUpdate) (User, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE users u
		SET full_name = $2, course_year = $3, email = $4, updated_at = now()
		WHERE u.id = $1
		RETURNING `+userColumns,
		userID, in.FullName, in.CourseYear, in.Email)
	u, err := scanUser(row)
	return u, mapUniqueViolation(err)
}

// ─── Enrollments ─────────────────────────────────────────────────────────────

type Enrollment struct {
	CourseSummary
	Status           string     `json:"status"`
	EnrolledAt       time.Time  `json:"enrolledAt"`
	CompletedAt      *time.Time `json:"completedAt"`
	LessonCount      int        `json:"lessonCount"`
	CompletedLessons int        `json:"completedLessons"`
	ProgressPercent  int        `json:"progressPercent"`
}

// Enroll joins the user to a published course. Re-enrolling after dropping reactivates the row.
func (s *Store) Enroll(ctx context.Context, userID, courseSlug string) error {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO enrollments (user_id, course_id)
		SELECT $1, c.id FROM courses c WHERE c.slug = $2 AND c.status = 'PUBLISHED'
		ON CONFLICT (user_id, course_id) DO UPDATE
		  SET status = CASE WHEN enrollments.status = 'DROPPED' THEN 'ACTIVE' ELSE enrollments.status END
		RETURNING id`, userID, courseSlug).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Store) Enrollments(ctx context.Context, userID string) ([]Enrollment, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.slug, i18n_text(c.i18n, $2, 'title', c.title), i18n_text(c.i18n, $2, 'summary', c.summary), c.level,
		       i18n_lang(c.i18n, $2, c.language), c.estimated_hours,
		       (SELECT count(*) FROM modules m WHERE m.course_id = c.id),
		       (SELECT count(*) FROM enrollments x WHERE x.course_id = c.id AND x.status <> 'DROPPED'),
		       t.slug, t.name,
		       ARRAY[c.language] || ARRAY(SELECT jsonb_object_keys(c.i18n)),
		       e.status, e.enrolled_at, e.completed_at,
		       (SELECT count(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id),
		       (SELECT count(*) FROM lesson_progress lp
		          JOIN lessons l ON l.id = lp.lesson_id
		          JOIN modules m ON m.id = l.module_id
		         WHERE m.course_id = c.id AND lp.user_id = e.user_id AND lp.completed_at IS NOT NULL)
		FROM enrollments e
		JOIN courses c ON c.id = e.course_id
		LEFT JOIN tracks t ON t.id = c.track_id
		WHERE e.user_id = $1 AND e.status <> 'DROPPED'
		ORDER BY e.enrolled_at DESC`, userID, langOf(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Enrollment{}
	for rows.Next() {
		var (
			e         Enrollment
			trackSlug *string
			trackName *string
		)
		if err := rows.Scan(
			&e.Slug, &e.Title, &e.Summary, &e.Level, &e.Language, &e.EstimatedHours,
			&e.ModuleCount, &e.LearnerCount, &trackSlug, &trackName, &e.Languages,
			&e.Status, &e.EnrolledAt, &e.CompletedAt, &e.LessonCount, &e.CompletedLessons,
		); err != nil {
			return nil, err
		}
		if trackSlug != nil && trackName != nil {
			e.Track = &TrackRef{Slug: *trackSlug, Name: *trackName}
		}
		if e.LessonCount > 0 {
			e.ProgressPercent = e.CompletedLessons * 100 / e.LessonCount
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
