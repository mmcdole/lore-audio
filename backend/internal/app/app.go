package app

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/lore/backend/internal/auth"
	"github.com/lore/backend/internal/config"
	"github.com/lore/backend/internal/database"
	"github.com/lore/backend/internal/metadata"
	"github.com/lore/backend/internal/repository"
	"github.com/lore/backend/internal/server"
	audiobooksvc "github.com/lore/backend/internal/services/audiobooks"
	importsvc "github.com/lore/backend/internal/services/import"
	librarysvc "github.com/lore/backend/internal/services/library"
)

// Run configures dependencies and starts the HTTP server until the context ends.
func Run(ctx context.Context, cfg config.Config) error {
	if err := config.EnsureRuntimeDirs(cfg); err != nil {
		return err
	}

	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		return err
	}
	defer db.Close()

	// Ensure admin user exists for fresh installations
	authSvc := auth.NewService(db)
	if err := authSvc.EnsureAdminUser(ctx, cfg.AdminUsername, cfg.AdminPassword); err != nil {
		return err
	}

	handler := buildHandler(db, cfg)
	srv := &http.Server{
		Addr:              cfg.Address,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		<-errCh
		return nil
	case err := <-errCh:
		return err
	}
}

func buildHandler(db *sql.DB, cfg config.Config) http.Handler {
	repo := repository.New(db)
	provider := metadata.NoopProvider{}
	authSvc := auth.NewService(db)
	librarySvc := librarysvc.NewService(repo, cfg.LibraryBrowseRoot)
	importSvc := importsvc.NewService(repo, cfg.ImportBrowseRoot)

	svc := audiobooksvc.New(repo, provider)
	return server.New(svc, authSvc, librarySvc, importSvc)
}
