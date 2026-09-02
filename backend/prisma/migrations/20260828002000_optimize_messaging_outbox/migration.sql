DROP INDEX "outbox_events_delivery_idx";

CREATE INDEX "outbox_events_event_type_published_at_dead_lettered_at_available_at_occurred_at_idx"
  ON "outbox_events"(
    "event_type",
    "published_at",
    "dead_lettered_at",
    "available_at",
    "occurred_at"
  );
