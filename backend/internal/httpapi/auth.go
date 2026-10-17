package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"aiinstitute/api/internal/auth"
	"aiinstitute/api/internal/store"
)

const (
	sessionCookie = "ai_session"
	sessionTTL    = 30 * 24 * time.Hour
)

type userCtxKey struct{}

// ─── Sessions ────────────────────────────────────────────────────────────────

func (s *Server) setSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,                 // not readable from JavaScript
		Secure:   s.opts.SecureCookies, // HTTPS only in production
		SameSite: http.SameSiteLaxMode, // not sent on cross-site POSTs: CSRF protection
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: s.opts.SecureCookies, SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID string) error {
	token, err := auth.NewToken()
	if err != nil {
		return err
	}
	expires := time.Now().Add(sessionTTL)
	if err := s.store.CreateSession(r.Context(), userID, auth.HashToken(token), expires, clientIP(r), r.UserAgent()); err != nil {
		return err
	}
	s.setSessionCookie(w, token, expires)
	return nil
}

// requireUser loads the signed-in user from the session cookie and passes it to the handler.
func (s *Server) requireUser(next func(http.ResponseWriter, *http.Request, store.User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil || c.Value == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		u, err := s.store.UserBySession(r.Context(), auth.HashToken(c.Value))
		if errors.Is(err, store.ErrNotFound) {
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if err != nil {
			s.log.Error("load session", "err", err)
			writeError(w, http.StatusInternalServerError, "internal")
			return
		}
		next(w, r, u)
	}
}

// ─── Request decoding ────────────────────────────────────────────────────────

// decodeJSON reads a small JSON body into dst. Requiring the JSON content type also rules out
// plain cross-site HTML form posts.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported_media_type")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request")
		return false
	}
	return true
}

func writeValidation(w http.ResponseWriter, fields map[string]string) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusUnprocessableEntity, errorBody{Error: "validation", Fields: fields})
}

func clientIP(r *http.Request) string {
	// The API sits behind the Next.js server, which forwards the visitor address.
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type registerRequest struct {
	FullName   string `json:"fullName"`
	Login      string `json:"login"`
	Email      string `json:"email"`
	CourseYear int    `json:"courseYear"`
	Password   string `json:"password"`
	Locale     string `json:"locale"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var in registerRequest
	if !decodeJSON(w, r, &in) {
		return
	}
	if !s.signUpRL.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "rate_limited")
		return
	}

	fields := map[string]string{}

	fullName, ok := auth.NormalizeFullName(in.FullName)
	if !ok {
		fields["fullName"] = "invalid"
	}
	login := auth.NormalizeLogin(in.Login)
	if !auth.ValidLogin(login) {
		fields["login"] = "invalid"
	}
	var email *string
	if e := strings.TrimSpace(in.Email); e != "" {
		if !auth.ValidEmail(e) {
			fields["email"] = "invalid"
		}
		email = &e
	}
	var year *int
	if in.CourseYear != 0 {
		if !auth.ValidCourseYear(in.CourseYear) {
			fields["courseYear"] = "invalid"
		}
		year = &in.CourseYear
	} else {
		fields["courseYear"] = "required"
	}
	if code := auth.CheckPassword(in.Password); code != "" {
		fields["password"] = code
	}
	if len(fields) > 0 {
		writeValidation(w, fields)
		return
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		s.log.Error("hash password", "err", err)
		writeError(w, http.StatusInternalServerError, "internal")
		return
	}
	locale := in.Locale
	if !store.ValidLang(locale) {
		locale = "kk"
	}

	user, err := s.store.CreateUser(r.Context(), store.NewUser{
		Login: login, FullName: fullName, Email: email, CourseYear: year, PasswordHash: hash, Locale: locale,
	})
	switch {
	case errors.Is(err, store.ErrLoginTaken):
		writeValidation(w, map[string]string{"login": "taken"})
		return
	case errors.Is(err, store.ErrEmailTaken):
		writeValidation(w, map[string]string{"email": "taken"})
		return
	case err != nil:
		s.log.Error("create user", "err", err)
		writeError(w, http.StatusInternalServerError, "internal")
		return
	}

	if err := s.startSession(w, r, user.ID); err != nil {
		s.log.Error("start session", "err", err)
		writeError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusCreated, user)
}

type loginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

// dummyHash is verified against when the account doesn't exist, so response time doesn't reveal
// whether a login is registered.
var (
	dummyOnce sync.Once
	dummyHash string
)

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in loginRequest
	if !decodeJSON(w, r, &in) {
		return
	}
	identifier := strings.TrimSpace(in.Login)
	if identifier == "" || in.Password == "" || len(identifier) > 254 || len(in.Password) > 1024 {
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}

	loginKey := strings.ToLower(identifier)
	if !s.loginIPRL.allow(clientIP(r)) || !s.loginRL.allow(loginKey) {
		writeError(w, http.StatusTooManyRequests, "rate_limited")
		return
	}

	user, hash, err := s.store.UserForLogin(r.Context(), identifier)
	if errors.Is(err, store.ErrNotFound) {
		dummyOnce.Do(func() { dummyHash, _ = auth.HashPassword("not-a-real-password!") })
		auth.VerifyPassword(in.Password, dummyHash)
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}
	if err != nil {
		s.log.Error("find user", "err", err)
		writeError(w, http.StatusInternalServerError, "internal")
		return
	}
	if !auth.VerifyPassword(in.Password, hash) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}

	s.loginRL.reset(loginKey)
	if err := s.startSession(w, r, user.ID); err != nil {
		s.log.Error("start session", "err", err)
		writeError(w, http.StatusInternalServerError, "internal")
		return
	}
	// Housekeeping: drop expired sessions now and then (best effort).
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.store.PurgeExpiredSessions(ctx)
	}()

	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		if err := s.store.DeleteSession(r.Context(), auth.HashToken(c.Value)); err != nil {
			s.log.Error("delete session", "err", err)
		}
	}
	s.clearSessionCookie(w)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request, u store.User) {
	s.respondPrivate(w, r, u, nil)
}

type updateMeRequest struct {
	FullName   string `json:"fullName"`
	CourseYear int    `json:"courseYear"`
	Email      string `json:"email"`
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request, u store.User) {
	var in updateMeRequest
	if !decodeJSON(w, r, &in) {
		return
	}
	fields := map[string]string{}

	fullName, ok := auth.NormalizeFullName(in.FullName)
	if !ok {
		fields["fullName"] = "invalid"
	}
	var year *int
	if in.CourseYear != 0 {
		if !auth.ValidCourseYear(in.CourseYear) {
			fields["courseYear"] = "invalid"
		}
		year = &in.CourseYear
	}
	var email *string
	if e := strings.TrimSpace(in.Email); e != "" {
		if !auth.ValidEmail(e) {
			fields["email"] = "invalid"
		}
		email = &e
	}
	if len(fields) > 0 {
		writeValidation(w, fields)
		return
	}

	updated, err := s.store.UpdateProfile(r.Context(), u.ID, store.ProfileUpdate{
		FullName: fullName, CourseYear: year, Email: email,
	})
	if errors.Is(err, store.ErrEmailTaken) {
		writeValidation(w, map[string]string{"email": "taken"})
		return
	}
	s.respondPrivate(w, r, updated, err)
}

func (s *Server) myEnrollments(w http.ResponseWriter, r *http.Request, u store.User) {
	v, err := s.store.Enrollments(r.Context(), u.ID)
	s.respondPrivate(w, r, v, err)
}

func (s *Server) enroll(w http.ResponseWriter, r *http.Request, u store.User) {
	err := s.store.Enroll(r.Context(), u.ID, r.PathValue("slug"))
	if err != nil {
		s.respondPrivate(w, r, nil, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}
