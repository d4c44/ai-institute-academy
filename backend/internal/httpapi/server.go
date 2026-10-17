// Package httpapi is the JSON HTTP layer. It uses only net/http (Go's method-aware ServeMux).
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"aiinstitute/api/internal/store"
)

type Options struct {
	// SecureCookies marks the session cookie Secure (HTTPS only). On in production.
	SecureCookies bool
	// PublicURL is the site address encoded in certificate QR codes (APP_URL).
	PublicURL string
	// Signature is the director's signature line printed on certificates.
	Signature string
}

type Server struct {
	store     *store.Store
	log       *slog.Logger
	opts      Options
	loginRL   *rateLimiter // attempts per login: stops password guessing on one account
	loginIPRL *rateLimiter // attempts per address, generous: many students share one campus NAT
	signUpRL  *rateLimiter
}

func New(st *store.Store, log *slog.Logger, opts Options) http.Handler {
	s := &Server{
		store:     st,
		log:       log,
		opts:      opts,
		loginRL:   newRateLimiter(10, 15*time.Minute),
		loginIPRL: newRateLimiter(200, 15*time.Minute),
		signUpRL:  newRateLimiter(10, time.Hour),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)

	// Public catalog.
	mux.HandleFunc("GET /api/v1/stats", s.stats)
	mux.HandleFunc("GET /api/v1/tracks", s.tracks)
	mux.HandleFunc("GET /api/v1/courses", s.courses)
	mux.HandleFunc("GET /api/v1/courses/{slug}", s.course)

	// Accounts.
	mux.HandleFunc("POST /api/v1/auth/register", s.register)
	mux.HandleFunc("POST /api/v1/auth/login", s.login)
	mux.HandleFunc("POST /api/v1/auth/logout", s.logout)
	mux.HandleFunc("GET /api/v1/me", s.requireUser(s.me))
	mux.HandleFunc("PATCH /api/v1/me", s.requireUser(s.updateMe))
	mux.HandleFunc("GET /api/v1/me/enrollments", s.requireUser(s.myEnrollments))
	mux.HandleFunc("POST /api/v1/courses/{slug}/enroll", s.requireUser(s.enroll))

	// Learning: progress, lessons, quizzes. All server-side checked for enrollment and unlocks.
	mux.HandleFunc("GET /api/v1/me/courses/{slug}", s.requireUser(s.learnCourse))
	mux.HandleFunc("GET /api/v1/me/lessons/{id}", s.requireUser(s.lesson))
	mux.HandleFunc("POST /api/v1/me/lessons/{id}/complete", s.requireUser(s.completeLesson))
	mux.HandleFunc("GET /api/v1/me/quizzes/{id}", s.requireUser(s.quiz))
	mux.HandleFunc("POST /api/v1/me/quizzes/{id}/submit", s.requireUser(s.submitQuiz))

	// Certificates: own list, and public verification + PDF by code.
	mux.HandleFunc("GET /api/v1/me/certificates", s.requireUser(s.myCertificates))
	mux.HandleFunc("GET /api/v1/certificates/{code}", s.verifyCertificate)
	mux.HandleFunc("GET /api/v1/certificates/{code}/pdf", s.certificatePDF)

	return chain(mux, s.recoverPanic, s.accessLog, withLang)
}

// ─── Public handlers ─────────────────────────────────────────────────────────

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		s.log.Error("health check", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "error", "database": "down"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "up"})
}

func (s *Server) stats(w http.ResponseWriter, r *http.Request) {
	v, err := s.store.Stats(r.Context())
	s.respondPublic(w, r, v, err)
}

func (s *Server) tracks(w http.ResponseWriter, r *http.Request) {
	v, err := s.store.Tracks(r.Context())
	s.respondPublic(w, r, v, err)
}

func (s *Server) courses(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.CourseFilter{
		Track:    q.Get("track"),
		Level:    strings.ToUpper(q.Get("level")),
		Language: q.Get("language"),
		Query:    strings.TrimSpace(q.Get("q")),
		Sort:     q.Get("sort"),
		Limit:    atoi(q.Get("limit")),
		Offset:   atoi(q.Get("offset")),
	}
	if len(f.Query) > 100 {
		f.Query = f.Query[:100]
	}
	v, err := s.store.Courses(r.Context(), f)
	s.respondPublic(w, r, v, err)
}

func (s *Server) course(w http.ResponseWriter, r *http.Request) {
	v, err := s.store.Course(r.Context(), r.PathValue("slug"))
	s.respondPublic(w, r, v, err)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type errorBody struct {
	Error  string            `json:"error"`
	Fields map[string]string `json:"fields,omitempty"`
}

// respondPublic is for data identical for every visitor: Next.js and CDNs may reuse it briefly.
func (s *Server) respondPublic(w http.ResponseWriter, r *http.Request, v any, err error) {
	s.respond(w, r, v, err, "public, max-age=30, stale-while-revalidate=300")
}

// respondPrivate is for per-user data: never stored by a shared cache.
func (s *Server) respondPrivate(w http.ResponseWriter, r *http.Request, v any, err error) {
	s.respond(w, r, v, err, "no-store")
}

func (s *Server) respond(w http.ResponseWriter, r *http.Request, v any, err error, cacheControl string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusNotFound, errorBody{Error: "not_found"})
	case errors.Is(err, store.ErrLocked):
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusForbidden, errorBody{Error: "locked"})
	case errors.Is(err, store.ErrNoAttempts):
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusForbidden, errorBody{Error: "no_attempts_left"})
	case err != nil:
		s.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusInternalServerError, errorBody{Error: "internal"})
	default:
		w.Header().Set("Cache-Control", cacheControl)
		writeJSON(w, http.StatusOK, v)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, status, errorBody{Error: code})
}

func atoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
