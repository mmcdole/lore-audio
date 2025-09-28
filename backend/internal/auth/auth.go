package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	apperrors "github.com/flix-audio/backend/internal/errors"
	"github.com/flix-audio/backend/internal/models"
)

// Use domain errors from the errors package
var (
	ErrInvalidCredentials = apperrors.ErrInvalidCredentials
	ErrUserNotFound       = apperrors.ErrUserNotFound
	ErrUnauthorized       = apperrors.ErrUnauthorized
	ErrForbidden          = apperrors.ErrForbidden
)

var (
	ErrMissingAuthorizationHeader = apperrors.NewHTTPError(http.StatusUnauthorized, "Missing authorization header", ErrUnauthorized)
	ErrInvalidAuthorizationFormat = apperrors.NewHTTPError(http.StatusUnauthorized, "Invalid authorization format", ErrUnauthorized)
	ErrInvalidAPIKey              = apperrors.NewHTTPError(http.StatusUnauthorized, "Invalid API key", ErrUnauthorized)
)

type contextKey string

const UserContextKey contextKey = "user"

// Service handles authentication operations.
type Service struct {
	db *sql.DB
}

// NewService creates a new authentication service.
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// HashPassword hashes a password using bcrypt.
func (s *Service) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword verifies a password against its hash.
func (s *Service) CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateAPIKey generates a random API key.
func (s *Service) GenerateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateUser creates a new user account.
func (s *Service) CreateUser(ctx context.Context, username, password string, isAdmin bool) (*models.User, error) {
	hash, err := s.HashPassword(password)
	if err != nil {
		return nil, err
	}

	userID := uuid.NewString()
	apiKey, err := s.GenerateAPIKey()
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO users (id, username, password_hash, is_admin, api_key, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, userID, username, hash, boolToInt(isAdmin), apiKey, now.Format(time.RFC3339))
	if err != nil {
		return nil, err
	}

	return s.GetUserByID(ctx, userID)
}

// Login authenticates a user with username/password and returns user info.
func (s *Service) Login(ctx context.Context, username, password string) (*models.User, error) {
	var user models.User
	var passwordHash string
	var createdAt string
	var isAdminInt int
	var apiKey sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, username, password_hash, is_admin, api_key, created_at
		FROM users WHERE username = ?
	`, username).Scan(&user.ID, &user.Username, &passwordHash, &isAdminInt, &apiKey, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if !s.CheckPassword(password, passwordHash) {
		return nil, ErrInvalidCredentials
	}

	user.IsAdmin = isAdminInt == 1
	if apiKey.Valid {
		user.APIKey = &apiKey.String
	}

	if user.CreatedAt, err = time.Parse(time.RFC3339, createdAt); err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByAPIKey retrieves a user by their API key.
func (s *Service) GetUserByAPIKey(ctx context.Context, apiKey string) (*models.User, error) {
	var user models.User
	var createdAt string
	var isAdminInt int

	err := s.db.QueryRowContext(ctx, `
		SELECT id, username, is_admin, created_at
		FROM users WHERE api_key = ?
	`, apiKey).Scan(&user.ID, &user.Username, &isAdminInt, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	user.IsAdmin = isAdminInt == 1
	user.APIKey = &apiKey

	if user.CreatedAt, err = time.Parse(time.RFC3339, createdAt); err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByID retrieves a user by their ID.
func (s *Service) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	var user models.User
	var createdAt string
	var isAdminInt int
	var apiKey sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, username, is_admin, api_key, created_at
		FROM users WHERE id = ?
	`, userID).Scan(&user.ID, &user.Username, &isAdminInt, &apiKey, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	user.IsAdmin = isAdminInt == 1
	if apiKey.Valid {
		user.APIKey = &apiKey.String
	}

	if user.CreatedAt, err = time.Parse(time.RFC3339, createdAt); err != nil {
		return nil, err
	}

	return &user, nil
}

// UpdateUserAPIKey updates a user's API key.
func (s *Service) UpdateUserAPIKey(ctx context.Context, userID, newAPIKey string) (*models.User, error) {
	_, err := s.db.ExecContext(ctx, `
		UPDATE users SET api_key = ? WHERE id = ?
	`, newAPIKey, userID)
	if err != nil {
		return nil, err
	}

	return s.GetUserByID(ctx, userID)
}

// ListUsers returns all users with pagination.
func (s *Service) ListUsers(ctx context.Context, offset, limit int) ([]*models.User, int, error) {
	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get users with pagination
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, username, is_admin, created_at
		FROM users 
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var isAdminInt int
		var createdAt string

		err := rows.Scan(&user.ID, &user.Username, &isAdminInt, &createdAt)
		if err != nil {
			return nil, 0, err
		}

		user.IsAdmin = isAdminInt == 1
		if user.CreatedAt, err = time.Parse(time.RFC3339, createdAt); err != nil {
			return nil, 0, err
		}

		users = append(users, &user)
	}

	return users, total, nil
}

// UpdateUser updates user information (admin status, username).
func (s *Service) UpdateUser(ctx context.Context, userID, username string, isAdmin *bool) (*models.User, error) {
	// Build dynamic query based on what's being updated
	setParts := []string{}
	args := []interface{}{}

	if username != "" {
		setParts = append(setParts, "username = ?")
		args = append(args, username)
	}
	if isAdmin != nil {
		setParts = append(setParts, "is_admin = ?")
		args = append(args, boolToInt(*isAdmin))
	}

	if len(setParts) == 0 {
		return s.GetUserByID(ctx, userID) // Nothing to update
	}

	args = append(args, userID)
	query := "UPDATE users SET " + strings.Join(setParts, ", ") + " WHERE id = ?"

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return s.GetUserByID(ctx, userID)
}

// UpdatePassword updates a user's password.
func (s *Service) UpdatePassword(ctx context.Context, userID, newPassword string) error {
	hash, err := s.HashPassword(newPassword)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE users SET password_hash = ? WHERE id = ?
	`, hash, userID)
	return err
}

// DeleteUser removes a user from the system.
func (s *Service) DeleteUser(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", userID)
	return err
}

// Authenticate validates the Authorization header and returns the associated user.
func (s *Service) Authenticate(ctx context.Context, authHeader string) (*models.User, error) {
	if strings.TrimSpace(authHeader) == "" {
		return nil, ErrMissingAuthorizationHeader
	}

	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(authHeader, bearerPrefix) {
		return nil, ErrInvalidAuthorizationFormat
	}

	apiKey := strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
	if apiKey == "" {
		return nil, ErrInvalidAuthorizationFormat
	}

	user, err := s.GetUserByAPIKey(ctx, apiKey)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidAPIKey
		}
		return nil, err
	}

	return user, nil
}

// EnsureAdmin validates that the provided user has admin privileges.
func EnsureAdmin(user *models.User) error {
	if user == nil {
		return ErrUnauthorized
	}
	if !user.IsAdmin {
		return ErrForbidden
	}
	return nil
}

// EnsureAdminUser creates an initial admin user if no users exist in the database.
// This ensures there's always a way to access the system on fresh installs.
func (s *Service) EnsureAdminUser(ctx context.Context, username, password string) error {
	// Check if any users exist
	var count int
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}

	// If users exist, nothing to do
	if count > 0 {
		return nil
	}

	// Create initial admin user
	_, err = s.CreateUser(ctx, username, password, true)
	return err
}

// GetUserFromContext extracts the user from the request context.
func GetUserFromContext(ctx context.Context) *models.User {
	user, ok := ctx.Value(UserContextKey).(*models.User)
	if !ok {
		return nil
	}
	return user
}

// Helper functions
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
