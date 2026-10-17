package certpdf

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Renders a certificate in every language, including a long course title and a long name, and
// checks that each result is a real PDF. Set CERT_SAMPLE_DIR to also keep the files for a visual check.
func TestRender(t *testing.T) {
	hours, score := 30, 92
	issued := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	dir := os.Getenv("CERT_SAMPLE_DIR")

	cases := []struct {
		lang, name, course string
		revoked            bool
	}{
		{"ru", "Нурлан Кульмурзаев", "Основы искусственного интеллекта", false},
		{"kk", "Айгерім Нұрланова", "Қазақ тіліне арналған табиғи тілді өңдеу және машиналық оқыту негіздері", false},
		{"en", "Nurlan Kulmurzaev", "Machine Learning Fundamentals", false},
		{"ko", "김민수", "교육 분야의 인공지능 도구", false},
		{"ko", "Айгерім Нұрланова", "인공지능 기초", false},
		{"en", "Maximilian Alexander von Hohenzollern-Sigmaringen", "Introduction to Artificial Intelligence and Data Science for Beginners", true},
	}
	for i, c := range cases {
		out, err := Render(Data{
			Code: "AIKAU-26-7K3M-9QX2", RecipientName: c.name, CourseTitle: c.course,
			CourseHours: &hours, FinalScore: &score, IssuedAt: issued, Revoked: c.revoked,
			VerifyURL: "https://example.kz/verify/AIKAU-26-7K3M-9QX2", Lang: c.lang,
		}, Signatory{Signature: "N. Kulmurzaev"})
		if err != nil {
			t.Fatalf("%s: %v", c.lang, err)
		}
		if !bytes.HasPrefix(out, []byte("%PDF-")) || len(out) < 20_000 {
			t.Fatalf("%s: not a plausible PDF (%d bytes)", c.lang, len(out))
		}
		if dir != "" {
			name := fmt.Sprintf("cert-%d-%s", i, c.lang)
			if c.revoked {
				name += "-revoked"
			}
			if err := os.WriteFile(filepath.Join(dir, name+".pdf"), out, 0o644); err != nil {
				t.Fatal(err)
			}
		}
	}
}
