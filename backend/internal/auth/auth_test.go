package auth

import "testing"

func TestCheckPassword(t *testing.T) {
	cases := []struct {
		pw   string
		want string
	}{
		{"", PasswordTooShort},
		{"Ab1!xyz", PasswordTooShort},     // 7 chars
		{"Abcdefg1", PasswordNeedsSymbol}, // 8 chars, no symbol
		{"abcdefgh", PasswordNeedsSymbol},
		{"abc def gh", PasswordNeedsSymbol}, // spaces are not symbols
		{"Abcdefg!", ""},                    // exactly 8, one symbol
		{"пароль_123", ""},                  // Cyrillic letters, underscore counts as a symbol
		{"Қазақстан#1", ""},                 // Kazakh letters
		{"pässwörd", PasswordNeedsSymbol},   // accented letters are letters
		{"12345678!", ""},
	}
	for _, c := range cases {
		if got := CheckPassword(c.pw); got != c.want {
			t.Errorf("CheckPassword(%q) = %q, want %q", c.pw, got, c.want)
		}
	}
	long := make([]byte, MaxPasswordLen+1)
	for i := range long {
		long[i] = 'a'
	}
	long[0] = '!'
	if got := CheckPassword(string(long)); got != PasswordTooLong {
		t.Errorf("129 chars = %q, want too_long", got)
	}
}

func TestHashAndVerify(t *testing.T) {
	hash, err := HashPassword("Abcdefg!")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword("Abcdefg!", hash) {
		t.Error("correct password rejected")
	}
	if VerifyPassword("Abcdefg?", hash) {
		t.Error("wrong password accepted")
	}
	other, _ := HashPassword("Abcdefg!")
	if hash == other {
		t.Error("two hashes of the same password are identical: salt not random")
	}
	for _, bad := range []string{"", "!", "$argon2id$", "plain"} {
		if VerifyPassword("Abcdefg!", bad) {
			t.Errorf("malformed hash %q accepted", bad)
		}
	}
}

func TestValidLogin(t *testing.T) {
	good := []string{"aigerim", "a.nurlanova", "student_01", "Ali-2026", "abc"}
	bad := []string{"", "ab", "_abc", "a b c", "имя_логин", "a@b.kz", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
	for _, s := range good {
		if !ValidLogin(s) {
			t.Errorf("ValidLogin(%q) = false", s)
		}
	}
	for _, s := range bad {
		if ValidLogin(s) {
			t.Errorf("ValidLogin(%q) = true", s)
		}
	}
}

func TestNormalizeFullName(t *testing.T) {
	good := map[string]string{
		"  Айгерім   Нұрланова ": "Айгерім Нұрланова",
		"Aigerim Nurlanova":      "Aigerim Nurlanova",
		"Анна-Мария О'Коннор":    "Анна-Мария О'Коннор",
	}
	for in, want := range good {
		got, ok := NormalizeFullName(in)
		if !ok || got != want {
			t.Errorf("NormalizeFullName(%q) = %q, %v; want %q, true", in, got, ok, want)
		}
	}
	for _, in := range []string{"", "Айгерім", "A B", "John 3rd Smith", "<script> alert", "Ali@ Veli"} {
		if _, ok := NormalizeFullName(in); ok {
			t.Errorf("NormalizeFullName(%q) accepted", in)
		}
	}
}

func TestValidEmail(t *testing.T) {
	for _, s := range []string{"a@b.kz", "first.last@kazu.edu.kz"} {
		if !ValidEmail(s) {
			t.Errorf("ValidEmail(%q) = false", s)
		}
	}
	for _, s := range []string{"", "a@b", "Name <a@b.kz>", "a b@c.kz", "@b.kz"} {
		if ValidEmail(s) {
			t.Errorf("ValidEmail(%q) = true", s)
		}
	}
}
