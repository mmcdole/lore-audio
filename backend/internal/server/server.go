package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/flix-audio/backend/internal/auth"
	"github.com/flix-audio/backend/internal/services/audiobooks"
	importservice "github.com/flix-audio/backend/internal/services/import"
	"github.com/flix-audio/backend/internal/services/library"
	"github.com/flix-audio/backend/internal/validation"
)

// New constructs the HTTP handler exposing the audiobook API.
func New(svc *audiobooks.Service, authSvc *auth.Service, librarySvc *library.Service, importSvc *importservice.Service) http.Handler {
	validator := validation.NewValidator()
	s := &handler{
		svc:        svc,
		authSvc:    authSvc,
		librarySvc: librarySvc,
		importSvc:  importSvc,
		validator:  validator,
	}

	r := chi.NewRouter()

	// Add middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(ErrorMiddleware)

	r.Route("/api/v1", func(r chi.Router) {
		// Public authentication endpoints
		r.Post("/auth/login", s.handleLogin)

		// Protected routes - require authentication
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(authSvc))

			// Logout endpoint (requires authentication)
			r.Post("/auth/logout", s.handleLogout)

			r.Route("/libraries", func(r chi.Router) {
				r.Get("/", s.handleAvailableLibraries)

				r.Route("/{library_id}", func(r chi.Router) {
					r.Get("/", s.handlePublicLibraryDetails)
					r.Get("/books", s.handleLibraryBooksList)
					r.Get("/books/search", s.handleLibraryBooksSearch)
					r.Get("/books/{book_id}", s.handleLibraryBookGet)
				})
			})

			// Personal library endpoints (authenticated users)
			r.Route("/library", func(r chi.Router) {
				r.Get("/", s.handleLibraryList)
				r.Get("/continue", s.handleLibraryContinue)
				r.Get("/favorites", s.handleLibraryFavorites)
				r.Get("/{audiobook_id}", s.handleLibraryGet)

				r.Route("/{audiobook_id}", func(r chi.Router) {
					r.Post("/progress", s.handleLibraryProgress)
					r.Post("/favorite", s.handleLibraryFavorite)
				})
			})

			// Self-service user endpoints (authenticated users)
			r.Route("/users", func(r chi.Router) {
				r.Get("/me", s.handleUserProfile)
				r.Patch("/me", s.handleUserUpdateProfile)
			})

			// Admin-only endpoints
			r.Route("/admin", func(r chi.Router) {
				r.Use(RequireAdmin)

				// Library path management
				r.Route("/library-paths", func(r chi.Router) {
					r.Get("/", s.handleAdminLibraryPathList)
					r.Post("/", s.handleAdminLibraryPathCreate)
					r.Patch("/{id}", s.handleAdminLibraryPathUpdate)
					r.Delete("/{id}", s.handleAdminLibraryPathDelete)
				})

				// Import folder configuration
				r.Route("/import-folders", func(r chi.Router) {
					r.Get("/", s.handleAdminImportFolderList)
					r.Post("/", s.handleAdminImportFolderCreate)
					r.Patch("/{id}", s.handleAdminImportFolderUpdate)
					r.Delete("/{id}", s.handleAdminImportFolderDelete)
				})

				// Import settings configuration
				r.Route("/import-settings", func(r chi.Router) {
					r.Get("/", s.handleAdminImportSettingsGet)
					r.Put("/", s.handleAdminImportSettingsUpdate)
				})

				// Legacy settings aliases
				r.Route("/settings", func(r chi.Router) {
					r.Route("/library-paths", func(r chi.Router) {
						r.Get("/", s.handleAdminLibraryPathList)
						r.Post("/", s.handleAdminLibraryPathCreate)
						r.Patch("/{id}", s.handleAdminLibraryPathUpdate)
						r.Delete("/{id}", s.handleAdminLibraryPathDelete)
					})
					r.Route("/import-folders", func(r chi.Router) {
						r.Get("/", s.handleAdminImportFolderList)
						r.Post("/", s.handleAdminImportFolderCreate)
						r.Patch("/{id}", s.handleAdminImportFolderUpdate)
						r.Delete("/{id}", s.handleAdminImportFolderDelete)
					})
					r.Route("/import-settings", func(r chi.Router) {
						r.Get("/", s.handleAdminImportSettingsGet)
						r.Put("/", s.handleAdminImportSettingsUpdate)
					})
				})

				// Library operations
				r.Route("/libraries", func(r chi.Router) {
					r.Get("/", s.handleAdminLibraryList)
					r.Post("/", s.handleAdminLibraryCreate)
					r.Post("/scan", s.handleAdminLibraryScanAll)
					r.Get("/{id}", s.handleAdminLibraryGet)
					r.Patch("/{id}", s.handleAdminLibraryUpdate)
					r.Delete("/{id}", s.handleAdminLibraryDelete)
					r.Post("/{id}/directories", s.handleAdminLibrarySetDirectories)
					r.Post("/{id}/scan", s.handleAdminLibraryScanOne)
				})

				// Import operations
				r.Route("/import", func(r chi.Router) {
					r.Get("/folders", s.handleAdminImportListFolders)
					r.Get("/folders/{folder_id}/browse", s.handleAdminImportBrowse)
					r.Post("/execute", s.handleAdminImportExecute)
					r.Get("/history", s.handleAdminImportHistory)
					r.Get("/history/{job_id}", s.handleAdminImportJob)
				})

				// Audiobook management
				r.Route("/audiobooks", func(r chi.Router) {
					r.Post("/", s.handleAdminAudiobookCreate)
					r.Delete("/{audiobook_id}", s.handleAdminAudiobookDelete)
					r.Put("/{audiobook_id}/link", s.handleAdminAudiobookLink)
					r.Delete("/{audiobook_id}/link", s.handleAdminAudiobookUnlink)
				})

				r.Route("/users", func(r chi.Router) {
					r.Get("/", s.handleAdminUserList)
					r.Post("/", s.handleAdminUserCreate)
					r.Get("/{user_id}", s.handleAdminUserGet)
					r.Patch("/{user_id}", s.handleAdminUserUpdate)
					r.Delete("/{user_id}", s.handleAdminUserDelete)
				})

				r.Get("/filesystem/{root}/browse", s.handleAdminBrowseRoot)
				r.Get("/filesystem/roots", s.handleAdminFilesystemRoots)

			})

			// Metadata search (authenticated users)
			r.Get("/metadata/search", s.handleMetadataSearch)

			// Media streaming (authorization checked within handler)
			r.Get("/media_files/{file_id}", s.handleMediaFileStream)
		})
	})

	return r
}

type handler struct {
	svc        *audiobooks.Service
	authSvc    *auth.Service
	librarySvc *library.Service
	importSvc  *importservice.Service
	validator  *validation.Validator
}

// Request/Response types
type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	APIKey string `json:"api_key"`
	User   struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		IsAdmin  bool   `json:"is_admin"`
	} `json:"user"`
}

type createUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	IsAdmin  bool   `json:"is_admin"`
}

type linkRequest struct {
	MetadataID string `json:"metadata_id"`
}

type progressRequest struct {
	ProgressSec float64 `json:"progress_sec"`
}

type favoriteRequest struct {
	IsFavorite bool `json:"is_favorite"`
}

type createLibraryRequest struct {
	Name         string                 `json:"name"`
	DisplayName  string                 `json:"display_name"`
	Type         string                 `json:"type"`
	Description  *string                `json:"description"`
	Settings     map[string]interface{} `json:"settings"`
	DirectoryIDs []string               `json:"directory_ids"`
}

type updateLibraryRequest struct {
	DisplayName  *string                 `json:"display_name"`
	Description  *string                 `json:"description"`
	Type         *string                 `json:"type"`
	Settings     *map[string]interface{} `json:"settings"`
	DirectoryIDs *[]string               `json:"directory_ids"`
}

type libraryDirectoriesRequest struct {
	DirectoryIDs []string `json:"directory_ids"`
}

type paginatedResponse struct {
	Data       interface{} `json:"data"`
	Pagination *struct {
		Offset int `json:"offset"`
		Limit  int `json:"limit"`
		Total  int `json:"total"`
	} `json:"pagination,omitempty"`
}

// Note: Error handling utilities moved to middleware.go
