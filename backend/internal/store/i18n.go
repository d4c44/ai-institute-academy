package store

import "context"

// Languages the platform serves. Anything else is treated as "no preference" (original text).
var supportedLangs = map[string]bool{"kk": true, "ru": true, "en": true, "ko": true}

type langKey struct{}

// WithLang records the language a request wants its course content in. Store queries pick it up
// with langOf, so a handler sets it once instead of every method taking a lang argument.
func WithLang(ctx context.Context, lang string) context.Context {
	if !supportedLangs[lang] {
		lang = ""
	}
	return context.WithValue(ctx, langKey{}, lang)
}

// langOf returns the requested content language, or "" for the original text.
func langOf(ctx context.Context) string {
	lang, _ := ctx.Value(langKey{}).(string)
	return lang
}

// ValidLang reports whether lang is one of the supported content languages.
func ValidLang(lang string) bool { return supportedLangs[lang] }
