package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/flix-audio/backend/internal/app"
	"github.com/flix-audio/backend/internal/config"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx, cfg); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
