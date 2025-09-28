export default function StatsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">Listening statistics</h2>
      <p className="text-sm text-muted-foreground">
        Detailed analytics and insights will live here. This scaffolding reserves space for weekly trends, listening streaks,
        and time-of-day breakdowns aligned with the broader roadmap.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border/30 bg-card/60 p-10 text-center text-muted-foreground">
          Listening heatmap coming soon
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/60 p-10 text-center text-muted-foreground">
          Favorite narrators analytics coming soon
        </div>
      </div>
    </div>
  );
}
