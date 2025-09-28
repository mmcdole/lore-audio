package server

import (
	"encoding/json"
	"net/http"

	"github.com/flix-audio/backend/internal/auth"
)

// Authentication handlers
func (h *handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	
	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "username and password are required")
		return
	}
	
	user, err := h.authSvc.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	
	// Ensure API key exists
	if user.APIKey == nil {
		respondError(w, http.StatusInternalServerError, "user API key not available")
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"user": map[string]interface{}{
				"id":       user.ID,
				"username": user.Username,
				"is_admin": user.IsAdmin,
			},
			"api_key": *user.APIKey,
		},
	})
}

func (h *handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}
	
	// Generate a new API key to invalidate the current one
	newAPIKey, err := h.authSvc.GenerateAPIKey()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	
	// Update the user's API key to invalidate the current session
	_, err = h.authSvc.UpdateUserAPIKey(r.Context(), user.ID, newAPIKey)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]string{
		"message": "logged out successfully",
	})
}

// Self-service user endpoints
func (h *handler) handleUserProfile(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": user})
}

func (h *handler) handleUserUpdateProfile(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	var req struct {
		Password *string `json:"password,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Only allow password updates for now
	if req.Password != nil {
		if *req.Password == "" {
			respondError(w, http.StatusBadRequest, "password cannot be empty")
			return
		}

		err := h.authSvc.UpdatePassword(r.Context(), user.ID, *req.Password)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	// Return updated user info
	updatedUser, err := h.authSvc.GetUserByID(r.Context(), user.ID)
	if err != nil {
		if err == auth.ErrUserNotFound {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": updatedUser})
}