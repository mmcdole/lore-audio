package server

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/flix-audio/backend/internal/auth"
	apperrors "github.com/flix-audio/backend/internal/errors"
)

// ErrorMiddleware handles errors consistently across all endpoints
func ErrorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Wrap the response writer to capture status codes
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		defer func() {
			if rec := recover(); rec != nil {
				// Handle panics gracefully - log the error
				log.Printf("PANIC recovered: %v", rec)
				respondError(rw, http.StatusInternalServerError, "An unexpected error occurred")
			}
		}()

		next.ServeHTTP(rw, r)
	})
}

// AuthMiddleware authenticates requests and attaches the user to the context.
func AuthMiddleware(authSvc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, err := authSvc.Authenticate(r.Context(), r.Header.Get("Authorization"))
			if err != nil {
				handleError(w, err)
				return
			}

			ctx := context.WithValue(r.Context(), auth.UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin ensures the request originates from an admin user.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := auth.GetUserFromContext(r.Context())
		if err := auth.EnsureAdmin(user); err != nil {
			handleError(w, err)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// responseWriter wraps http.ResponseWriter to capture status codes
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Enhanced error response function
func respondError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := map[string]interface{}{
		"error":  message,
		"status": statusCode,
	}

	json.NewEncoder(w).Encode(response)
}

// Handle domain errors properly
func handleError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}

	statusCode := apperrors.ToHTTPStatus(err)
	message := apperrors.ToClientMessage(err)

	respondError(w, statusCode, message)
}

// Enhanced JSON response function
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if payload == nil {
		w.WriteHeader(status)
		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(payload); err != nil {
		log.Printf("respondJSON: encode error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to encode response")
		return
	}

	w.WriteHeader(status)
	if _, err := w.Write(buf.Bytes()); err != nil {
		log.Printf("respondJSON: write error: %v", err)
	}
}
