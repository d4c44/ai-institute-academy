package httpapi

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"aiinstitute/api/internal/certpdf"
	"aiinstitute/api/internal/store"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// pathID returns the {id} path value, answering 404 itself when it isn't a UUID (so a malformed
// id never reaches the database as a type error).
func pathID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.PathValue("id")
	if !uuidRe.MatchString(id) {
		writeError(w, http.StatusNotFound, "not_found")
		return "", false
	}
	return id, true
}

// ─── Learning ────────────────────────────────────────────────────────────────

func (s *Server) learnCourse(w http.ResponseWriter, r *http.Request, u store.User) {
	v, err := s.store.CourseProgress(r.Context(), u.ID, r.PathValue("slug"))
	s.respondPrivate(w, r, v, err)
}

func (s *Server) lesson(w http.ResponseWriter, r *http.Request, u store.User) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	v, err := s.store.Lesson(r.Context(), u.ID, id)
	s.respondPrivate(w, r, v, err)
}

func (s *Server) completeLesson(w http.ResponseWriter, r *http.Request, u store.User) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	v, err := s.store.CompleteLesson(r.Context(), u.ID, id)
	s.respondPrivate(w, r, v, err)
}

func (s *Server) quiz(w http.ResponseWriter, r *http.Request, u store.User) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	v, err := s.store.Quiz(r.Context(), u.ID, id)
	s.respondPrivate(w, r, v, err)
}

type submitQuizRequest struct {
	Answers map[string][]string `json:"answers"`
}

func (s *Server) submitQuiz(w http.ResponseWriter, r *http.Request, u store.User) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in submitQuizRequest
	if !decodeJSON(w, r, &in) {
		return
	}
	if len(in.Answers) > 200 {
		writeError(w, http.StatusBadRequest, "bad_request")
		return
	}
	v, err := s.store.SubmitQuiz(r.Context(), u.ID, id, in.Answers)
	s.respondPrivate(w, r, v, err)
}

// ─── Certificates ────────────────────────────────────────────────────────────

func (s *Server) myCertificates(w http.ResponseWriter, r *http.Request, u store.User) {
	v, err := s.store.MyCertificates(r.Context(), u.ID)
	s.respondPrivate(w, r, v, err)
}

// verifyCertificate is public: anyone holding a certificate ID or QR code can check it.
func (s *Server) verifyCertificate(w http.ResponseWriter, r *http.Request) {
	v, err := s.store.CertificateByCode(r.Context(), r.PathValue("code"))
	if err == nil {
		if title := s.store.LocalizedCertificateTitle(r.Context(), v.Code); title != "" {
			v.CourseTitle = title
		}
		// Status can change (revocation), so intermediaries must not hold on to it.
		w.Header().Set("Cache-Control", "no-store")
	}
	s.respond(w, r, v, err, "no-store")
}

func (s *Server) certificatePDF(w http.ResponseWriter, r *http.Request) {
	c, err := s.store.CertificateByCode(r.Context(), r.PathValue("code"))
	if err != nil {
		s.respondPrivate(w, r, nil, err)
		return
	}
	lang := r.URL.Query().Get("lang")
	if !store.ValidLang(lang) {
		lang = c.Locale
	}
	if title := s.store.LocalizedCertificateTitle(store.WithLang(r.Context(), lang), c.Code); title != "" {
		c.CourseTitle = title
	}

	pdf, err := certpdf.Render(certpdf.Data{
		Code:          c.Code,
		RecipientName: c.RecipientName,
		CourseTitle:   c.CourseTitle,
		CourseHours:   c.CourseHours,
		FinalScore:    c.FinalScore,
		IssuedAt:      c.IssuedAt,
		Revoked:       c.Status != "VALID",
		VerifyURL:     strings.TrimRight(s.opts.PublicURL, "/") + "/verify/" + c.Code,
		Lang:          lang,
	}, certpdf.Signatory{Signature: s.opts.Signature})
	if err != nil {
		s.log.Error("render certificate pdf", "code", c.Code, "err", err)
		writeError(w, http.StatusInternalServerError, "internal")
		return
	}

	disposition := "inline"
	if r.URL.Query().Get("download") == "1" {
		disposition = "attachment"
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="certificate-%s.pdf"`, disposition, c.Code))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(pdf)
}
