package auth

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var loginRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$`)

// NormalizeLogin trims the input; logins are matched case-insensitively in the database.
func NormalizeLogin(s string) string { return strings.TrimSpace(s) }

// ValidLogin: 3–32 characters, Latin letters, digits, dot, underscore or hyphen; starts with a letter or digit.
func ValidLogin(s string) bool { return loginRe.MatchString(s) }

// NormalizeFullName collapses runs of whitespace and reports whether the result looks like a
// full name: at least two words, 2–100 characters, letters (any script), hyphen, apostrophe, dot.
func NormalizeFullName(s string) (string, bool) {
	name := strings.Join(strings.Fields(s), " ")
	if n := utf8.RuneCountInString(name); n < 5 || n > 100 {
		return name, false
	}
	if len(strings.Fields(name)) < 2 {
		return name, false
	}
	for _, r := range name {
		ok := unicode.IsLetter(r) || unicode.IsMark(r) || r == ' ' || r == '-' || r == '\'' || r == '’' || r == '.'
		if !ok {
			return name, false
		}
	}
	return name, true
}

// ValidEmail accepts a bare address ("a@b.kz"), not "Name <a@b.kz>".
func ValidEmail(s string) bool {
	if len(s) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s && strings.Contains(s[strings.LastIndex(s, "@"):], ".")
}

// ValidCourseYear: year of study, 1–6 (bachelor, master, doctoral).
func ValidCourseYear(y int) bool { return y >= 1 && y <= 6 }
