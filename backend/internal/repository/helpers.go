package repository

// Helper functions shared across repositories

// sqlNullString handles nullable string conversion
func sqlNullString(s *string) interface{} {
	if s == nil {
		return nil
	}
	return *s
}

// sqlNullStringPtr handles nullable string pointer conversion
func sqlNullStringPtr(s *string) interface{} {
	if s == nil {
		return nil
	}
	return *s
}

// boolToInt converts boolean to int for database storage
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}