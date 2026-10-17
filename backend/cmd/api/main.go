// Command api serves the AI Institute JSON API.
//
//	api            start the server
//	api migrate    apply database migrations and exit
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"aiinstitute/api/internal/config"
	"aiinstitute/api/internal/httpapi"
	"aiinstitute/api/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		log.Info("applying migrations")
		return store.Migrate(ctx, cfg.DatabaseURL)
	}

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer st.Close()

	// Secure cookies are only sent over HTTPS, so they follow the public address: a production
	// site still reached over plain HTTP (no domain yet) could not sign anyone in otherwise.
	secure := cfg.Env == "production" && strings.HasPrefix(cfg.PublicURL, "https://")
	if cfg.Env == "production" && !secure {
		log.Warn("APP_URL is not https: session cookies are not marked Secure", "app_url", cfg.PublicURL)
	}

	srv := &http.Server{
		Addr: cfg.Addr,
		Handler: httpapi.New(st, log, httpapi.Options{
			SecureCookies: secure,
			PublicURL:     cfg.PublicURL,
			Signature:     "N. Kulmurzaev",
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", cfg.Addr, "env", cfg.Env)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}
