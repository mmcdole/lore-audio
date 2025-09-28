package database

import (
	"context"
	"database/sql"
)

// SQLDB interface for both *sql.DB and *sql.Tx
type SQLDB interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// Ensure *sql.DB and *sql.Tx implement SQLDB
var _ SQLDB = (*sql.DB)(nil)
var _ SQLDB = (*sql.Tx)(nil)