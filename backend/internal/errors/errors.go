package errors

import (
	"errors"
	"fmt"
	"net/http"
)

// Domain errors - these represent business logic errors
var (
	// Authentication errors
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserNotFound       = errors.New("user not found")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrForbidden          = errors.New("forbidden")
	ErrUserExists         = errors.New("user already exists")

	// Audiobook errors
	ErrAudiobookNotFound   = errors.New("audiobook not found")
	ErrAudiobookExists     = errors.New("audiobook already exists")
	ErrInvalidAudiobook    = errors.New("invalid audiobook")
	ErrAudiobookInLibrary  = errors.New("audiobook already in library")
	ErrAudiobookNotInLibrary = errors.New("audiobook not in user's library")

	// File errors
	ErrFileNotFound    = errors.New("file not found")
	ErrInvalidPath     = errors.New("invalid file path")
	ErrFileAccess      = errors.New("file access denied")

	// Validation errors
	ErrInvalidInput    = errors.New("invalid input")
	ErrMissingField    = errors.New("required field missing")
	ErrInvalidFormat   = errors.New("invalid format")
	ErrOutOfRange      = errors.New("value out of range")

	// Database errors
	ErrDatabaseConnection = errors.New("database connection failed")
	ErrTransactionFailed  = errors.New("transaction failed")
	ErrConstraintViolation = errors.New("database constraint violation")
)

// ValidationError represents a validation error with field context
type ValidationError struct {
	Field   string
	Message string
	Value   interface{}
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("validation error on field '%s': %s", e.Field, e.Message)
}

// NewValidationError creates a new validation error
func NewValidationError(field, message string, value interface{}) *ValidationError {
	return &ValidationError{
		Field:   field,
		Message: message,
		Value:   value,
	}
}

// HTTPError represents an error that should be returned as an HTTP response
type HTTPError struct {
	Code    int
	Message string
	Err     error
}

func (e HTTPError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("HTTP %d: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("HTTP %d: %s", e.Code, e.Message)
}

func (e HTTPError) Unwrap() error {
	return e.Err
}

// NewHTTPError creates a new HTTP error
func NewHTTPError(code int, message string, err error) *HTTPError {
	return &HTTPError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// Wrap wraps an error with additional context
func Wrap(err error, message string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}

// Wrapf wraps an error with formatted context
func Wrapf(err error, format string, args ...interface{}) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", fmt.Sprintf(format, args...), err)
}

// ToHTTPStatus maps domain errors to HTTP status codes
func ToHTTPStatus(err error) int {
	if err == nil {
		return http.StatusOK
	}

	// Check if it's already an HTTPError
	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		return httpErr.Code
	}

	// Map domain errors to HTTP status codes
	switch {
	case errors.Is(err, ErrUserNotFound),
		 errors.Is(err, ErrAudiobookNotFound),
		 errors.Is(err, ErrFileNotFound):
		return http.StatusNotFound

	case errors.Is(err, ErrInvalidCredentials),
		 errors.Is(err, ErrUnauthorized):
		return http.StatusUnauthorized

	case errors.Is(err, ErrForbidden):
		return http.StatusForbidden

	case errors.Is(err, ErrUserExists),
		 errors.Is(err, ErrAudiobookExists),
		 errors.Is(err, ErrAudiobookInLibrary):
		return http.StatusConflict

	case errors.Is(err, ErrInvalidInput),
		 errors.Is(err, ErrMissingField),
		 errors.Is(err, ErrInvalidFormat),
		 errors.Is(err, ErrOutOfRange):
		return http.StatusBadRequest

	default:
		// Check if it's a validation error
		var validationErr *ValidationError
		if errors.As(err, &validationErr) {
			return http.StatusBadRequest
		}

		return http.StatusInternalServerError
	}
}

// ToClientMessage returns a safe message for client consumption
func ToClientMessage(err error) string {
	if err == nil {
		return ""
	}

	// Check if it's an HTTPError with a specific message
	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		return httpErr.Message
	}

	// Check if it's a validation error
	var validationErr *ValidationError
	if errors.As(err, &validationErr) {
		return validationErr.Error()
	}

	// Map domain errors to client-safe messages
	switch {
	case errors.Is(err, ErrUserNotFound):
		return "User not found"
	case errors.Is(err, ErrAudiobookNotFound):
		return "Audiobook not found"
	case errors.Is(err, ErrFileNotFound):
		return "File not found"
	case errors.Is(err, ErrInvalidCredentials):
		return "Invalid username or password"
	case errors.Is(err, ErrUnauthorized):
		return "Authentication required"
	case errors.Is(err, ErrForbidden):
		return "Access denied"
	case errors.Is(err, ErrUserExists):
		return "User already exists"
	case errors.Is(err, ErrAudiobookExists):
		return "Audiobook already exists"
	case errors.Is(err, ErrAudiobookInLibrary):
		return "Audiobook already in library"
	case errors.Is(err, ErrAudiobookNotInLibrary):
		return "Audiobook not in your library"
	case errors.Is(err, ErrInvalidInput):
		return "Invalid input provided"
	case errors.Is(err, ErrMissingField):
		return "Required field missing"
	case errors.Is(err, ErrInvalidFormat):
		return "Invalid format"
	case errors.Is(err, ErrOutOfRange):
		return "Value out of range"
	default:
		// For unknown errors, return a generic message to avoid leaking internal details
		return "An error occurred while processing your request"
	}
}