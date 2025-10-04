package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/lore/backend/internal/app"
	"github.com/lore/backend/internal/config"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx, cfg); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
