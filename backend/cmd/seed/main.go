package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/lore/backend/internal/database"
	"github.com/lore/backend/internal/testdata"
)

func main() {
	fmt.Println("📚 Flix Audio Test Data Seeder\n")

	// Get database path from environment or use default
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "data/lore.db"
	}

	// Open database (applies schema automatically)
	db, err := database.Open(dbPath)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}
	defer db.Close()

	// Seed test data
	ctx := context.Background()
	if err := testdata.SeedTestBooks(ctx, db); err != nil {
		log.Fatalf("❌ Seeding failed: %v", err)
	}

	fmt.Println("\n✨ Test data seeding complete!")
	fmt.Println("📖 You can now test the application with sample audiobooks.")
	fmt.Println("\nBook states created:")
	fmt.Println("  • 5 books not started (no user data)")
	fmt.Println("  • 4 books in progress (varying progress)")
	fmt.Println("  • 3 books completed (100% progress)")
	fmt.Println("  • 4 books marked as favorites")
	fmt.Println("\nStart the server and navigate to:")
	fmt.Println("  • /home - See Continue Listening")
	fmt.Println("  • /favorites - See favorite books")
	fmt.Println("  • /library - Browse all books")
}