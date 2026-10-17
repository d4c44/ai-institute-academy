// Package auth holds credential rules: password policy and hashing, input validation, session tokens.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters (RFC 9106 "second recommended" profile, 64 MiB).
const (
	argonTime    = 3
	argonMemory  = 64 * 1024
	argonThreads = 2
	argonKeyLen  = 32
	argonSaltLen = 16
)

const (
	MinPasswordLen = 8
	MaxPasswordLen = 128
)

// Password policy violations, returned as stable codes the frontend translates.
const (
	PasswordTooShort    = "too_short"
	PasswordTooLong     = "too_long"
	PasswordNeedsSymbol = "needs_symbol"
)

// CheckPassword enforces: at least 8 characters and at least one special character
// (anything that is not a letter, digit or whitespace). Returns "" when the password is acceptable.
func CheckPassword(pw string) string {
	n := utf8.RuneCountInString(pw)
	switch {
	case n < MinPasswordLen:
		return PasswordTooShort
	case n > MaxPasswordLen:
		return PasswordTooLong
	}
	for _, r := range pw {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && !unicode.IsSpace(r) {
			return ""
		}
	}
	return PasswordNeedsSymbol
}

// HashPassword returns a self-describing encoded argon2id hash:
// $argon2id$v=19$m=65536,t=3,p=2$<salt>$<hash>
func HashPassword(pw string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(pw), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

// VerifyPassword reports whether pw matches the encoded hash. Malformed hashes (including the
// "!" placeholder used for accounts that can't sign in) never match.
func VerifyPassword(pw, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false
	}
	var memory, time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(want) == 0 {
		return false
	}
	got := argon2.IDKey([]byte(pw), salt, time, memory, threads, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1
}
