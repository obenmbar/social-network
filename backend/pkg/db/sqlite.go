package db

import (
	"database/sql"
	"log"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/mattn/go-sqlite3"
)

func Init(dbPath string) {*sql.DB, error} {
	dsn := dbPath + "?_foreign_keys=on&_journal_mode=WAL"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("SQLITE open failed: %w", err)
	}

	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("DATABASE ping failed: %w", err)
	}

	m, err := migrate.New(
		"file://pkg/db/migrations/sqlite",
		"sqlite3://"+dbPath,
	)

	if err != nil {
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	if err = m.Up(); err!= nil && err != migrate.ErrNoCharge {
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	log.Println("Database connected & migrations applied")
	return db, nil
}