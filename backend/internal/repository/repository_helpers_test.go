package repository

import (
	"database/sql"
	"testing"
)

func TestMarshalLibrarySettingsNil(t *testing.T) {
	value, err := marshalLibrarySettings(nil)
	if err != nil {
		t.Fatalf("marshalLibrarySettings(nil) returned error: %v", err)
	}
	if value != nil {
		t.Fatalf("expected nil, got %v", value)
	}
}

func TestMarshalLibrarySettingsRoundTrip(t *testing.T) {
	settings := map[string]interface{}{
		"foo":   "bar",
		"count": 3,
	}

	encoded, err := marshalLibrarySettings(settings)
	if err != nil {
		t.Fatalf("marshalLibrarySettings returned error: %v", err)
	}
	if encoded == nil {
		t.Fatalf("expected encoded string, got nil")
	}

	decoded, err := unmarshalLibrarySettings(sql.NullString{String: *encoded, Valid: true})
	if err != nil {
		t.Fatalf("unmarshalLibrarySettings returned error: %v", err)
	}

	if decoded["foo"] != "bar" {
		t.Fatalf("expected foo=bar, got %v", decoded["foo"])
	}

	count, ok := decoded["count"].(float64)
	if !ok || count != 3 {
		t.Fatalf("expected count=3, got %v", decoded["count"])
	}
}

func TestUnmarshalLibrarySettingsInvalid(t *testing.T) {
	if _, err := unmarshalLibrarySettings(sql.NullString{String: "{", Valid: true}); err == nil {
		t.Fatalf("expected error for invalid JSON")
	}
}
