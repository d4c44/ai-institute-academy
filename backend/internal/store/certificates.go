package store

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Certificate struct {
	Code          string     `json:"code"`
	Status        string     `json:"status"` // VALID | REVOKED | SUPERSEDED
	RecipientName string     `json:"recipientName"`
	CourseTitle   string     `json:"courseTitle"`
	CourseHours   *int       `json:"courseHours"`
	FinalScore    *int       `json:"finalScore"`
	Locale        string     `json:"locale"`
	IssuedAt      time.Time  `json:"issuedAt"`
	RevokedAt     *time.Time `json:"revokedAt"`
	RevokedReason *string    `json:"revokedReason"`
}

type OwnCertificate struct {
	Certificate
	CourseSlug string `json:"courseSlug"`
}

// Code alphabet: no 0/O, 1/I/L. 32 symbols, so 8 random characters give 40 bits.
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

// newCertificateCode returns e.g. AIKAU-26-7K3M-9QX2. It is public (printed on the PDF, encoded in
// the QR), so it is random and unguessable rather than a sequence number.
func newCertificateCode(now time.Time) (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	var sb strings.Builder
	for i, v := range b {
		if i == 4 {
			sb.WriteByte('-')
		}
		sb.WriteByte(codeAlphabet[int(v)%len(codeAlphabet)])
	}
	return fmt.Sprintf("AIKAU-%02d-%s", now.Year()%100, sb.String()), nil
}

// NormalizeCode makes user-typed codes comparable: trims and uppercases.
func NormalizeCode(code string) string { return strings.ToUpper(strings.TrimSpace(code)) }

const certificateColumns = `ce.code, ce.status, ce.recipient_name, ce.course_title, ce.course_hours,
	ce.final_score, ce.locale, ce.issued_at, ce.revoked_at, ce.revoked_reason`

func scanCertificate(row pgx.Row, extra ...any) (Certificate, error) {
	var c Certificate
	dest := append([]any{&c.Code, &c.Status, &c.RecipientName, &c.CourseTitle, &c.CourseHours,
		&c.FinalScore, &c.Locale, &c.IssuedAt, &c.RevokedAt, &c.RevokedReason}, extra...)
	err := row.Scan(dest...)
	return c, err
}

// CertificateByCode is the public verification lookup.
func (s *Store) CertificateByCode(ctx context.Context, code string) (Certificate, error) {
	c, err := scanCertificate(s.pool.QueryRow(ctx,
		`SELECT `+certificateColumns+` FROM certificates ce WHERE ce.code = $1`, NormalizeCode(code)))
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}

func (s *Store) MyCertificates(ctx context.Context, userID string) ([]OwnCertificate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+certificateColumns+`, co.slug
		FROM certificates ce
		JOIN enrollments e ON e.id = ce.enrollment_id
		JOIN courses co ON co.id = e.course_id
		WHERE e.user_id = $1
		ORDER BY ce.issued_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []OwnCertificate{}
	for rows.Next() {
		var o OwnCertificate
		c, err := scanCertificate(rows, &o.CourseSlug)
		if err != nil {
			return nil, err
		}
		o.Certificate = c
		out = append(out, o)
	}
	return out, rows.Err()
}

// IssueCertificateIfEligible issues the course certificate when every requirement is met:
// all lessons completed, every module quiz passed and the final exam passed. It is safe to call
// after any progress change and from concurrent requests: the enrollment row is locked, and a
// student gets at most one certificate per enrollment (a revoked one is not silently re-issued).
// It returns the student's certificate for the course, or nil when not yet eligible.
func (s *Store) IssueCertificateIfEligible(ctx context.Context, userID, courseID string) (*Certificate, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var enrollmentID string
	err = tx.QueryRow(ctx, `
		SELECT id FROM enrollments
		WHERE user_id = $1 AND course_id = $2 AND status <> 'DROPPED'
		FOR UPDATE`, userID, courseID).Scan(&enrollmentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Already certified?
	existing, err := scanCertificate(tx.QueryRow(ctx, `
		SELECT `+certificateColumns+` FROM certificates ce
		WHERE ce.enrollment_id = $1
		ORDER BY (ce.status = 'VALID') DESC, ce.issued_at DESC LIMIT 1`, enrollmentID))
	if err == nil {
		return &existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	var lessons, doneLessons, quizzes, passedQuizzes int
	var finalScore *int
	err = tx.QueryRow(ctx, `
		WITH q AS (
		  SELECT id, final_for_course_id FROM quizzes
		  WHERE final_for_course_id = $2 OR module_id IN (SELECT id FROM modules WHERE course_id = $2)
		)
		SELECT
		  (SELECT count(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = $2),
		  (SELECT count(*) FROM lesson_progress lp
		     JOIN lessons l ON l.id = lp.lesson_id JOIN modules m ON m.id = l.module_id
		    WHERE m.course_id = $2 AND lp.user_id = $1 AND lp.completed_at IS NOT NULL),
		  (SELECT count(*) FROM q),
		  (SELECT count(*) FROM q WHERE EXISTS
		     (SELECT 1 FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.user_id = $1 AND a.passed)),
		  (SELECT max(a.score) FROM quiz_attempts a JOIN q ON q.id = a.quiz_id
		    WHERE q.final_for_course_id IS NOT NULL AND a.user_id = $1 AND a.passed)`,
		userID, courseID).Scan(&lessons, &doneLessons, &quizzes, &passedQuizzes, &finalScore)
	if err != nil {
		return nil, err
	}
	if lessons == 0 || doneLessons < lessons || passedQuizzes < quizzes {
		return nil, nil
	}

	var name, locale, title string
	var hours *int
	err = tx.QueryRow(ctx, `
		SELECT u.full_name, u.locale, i18n_text(c.i18n, u.locale, 'title', c.title), c.estimated_hours
		FROM users u, courses c WHERE u.id = $1 AND c.id = $2`, userID, courseID).Scan(&name, &locale, &title, &hours)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE enrollments SET status = 'COMPLETED', completed_at = COALESCE(completed_at, now())
		WHERE id = $1`, enrollmentID); err != nil {
		return nil, err
	}

	var cert Certificate
	for attempt := 0; attempt < 5; attempt++ {
		code, err := newCertificateCode(time.Now())
		if err != nil {
			return nil, err
		}
		// A savepoint, so a code collision doesn't abort the whole transaction.
		sp, err := tx.Begin(ctx)
		if err != nil {
			return nil, err
		}
		cert, err = scanCertificate(sp.QueryRow(ctx, `
			WITH ins AS (
			  INSERT INTO certificates AS ce (code, enrollment_id, recipient_name, course_title, course_hours, final_score, locale)
			  VALUES ($1, $2, $3, $4, $5, $6, $7)
			  RETURNING *
			)
			SELECT `+strings.ReplaceAll(certificateColumns, "ce.", "ins.")+` FROM ins`,
			code, enrollmentID, name, title, hours, finalScore, locale))
		if err != nil {
			_ = sp.Rollback(ctx)
			var pg *pgconn.PgError
			if errors.As(err, &pg) && pg.Code == "23505" {
				continue
			}
			return nil, err
		}
		if err := sp.Commit(ctx); err != nil {
			return nil, err
		}
		break
	}
	if cert.Code == "" {
		return nil, errors.New("could not allocate a unique certificate code")
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &cert, nil
}

// LocalizedCertificateTitle returns the course title translated into the requested language
// (see WithLang) when that differs from the language the certificate was issued in and a
// translation exists. It returns "" when the stored title should be used as is.
func (s *Store) LocalizedCertificateTitle(ctx context.Context, code string) string {
	lang := langOf(ctx)
	if lang == "" {
		return ""
	}
	var title string
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(i18n_text(co.i18n, $2, 'title', ''), ''), CASE WHEN co.language = $2 THEN co.title ELSE '' END)
		FROM certificates ce
		JOIN enrollments e ON e.id = ce.enrollment_id
		JOIN courses co ON co.id = e.course_id
		WHERE ce.code = $1 AND ce.locale <> $2`, NormalizeCode(code), lang).Scan(&title)
	if err != nil {
		return ""
	}
	return title
}
