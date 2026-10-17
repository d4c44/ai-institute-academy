// Package config reads settings from the environment (a .env file is loaded first, if present).
package config

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Addr        string // listen address, e.g. ":8080"
	DatabaseURL string
	Env         string // "development" | "production"
	PublicURL   string // site address used in certificate QR codes
}

func Load() (Config, error) {
	// Missing file is fine: production gets real environment variables.
	_ = godotenv.Load()

	cfg := Config{
		Addr:        get("ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Env:         get("APP_ENV", "development"),
		PublicURL:   get("APP_URL", "http://localhost:3000"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is not set (copy .env.example to .env)")
	}
	return cfg, nil
}

func get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
