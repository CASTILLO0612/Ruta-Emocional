ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_currency_code_format"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "service_requests_expiry_after_creation"
    CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "service_requests_schedule_after_creation"
    CHECK ("scheduled_for" IS NULL OR "scheduled_for" > "created_at"),
  ADD CONSTRAINT "service_requests_location_has_expiry"
    CHECK ("location" IS NULL OR "location_expires_at" IS NOT NULL);

CREATE UNIQUE INDEX "offers_one_accepted_per_request_idx"
  ON "offers"("request_id")
  WHERE "status" = 'ACCEPTED';

CREATE OR REPLACE FUNCTION validate_request_status_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = NEW."status" THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('BIDDING', 'CANCELLED', 'EXPIRED'))
    OR (OLD."status" = 'BIDDING' AND NEW."status" IN ('ACCEPTED', 'CANCELLED', 'EXPIRED'))
    OR (OLD."status" = 'ACCEPTED' AND NEW."status" = 'IN_SESSION')
    OR (OLD."status" = 'IN_SESSION' AND NEW."status" = 'COMPLETED')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Invalid service request transition from %s to %s',
        OLD."status",
        NEW."status"
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_requests_valid_status_transition
BEFORE UPDATE OF "status" ON "service_requests"
FOR EACH ROW EXECUTE FUNCTION validate_request_status_transition();

CREATE OR REPLACE FUNCTION validate_offer_status_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = NEW."status" THEN
    RETURN NEW;
  END IF;

  IF OLD."status" <> 'PENDING'
     OR NEW."status" NOT IN ('ACCEPTED', 'REJECTED', 'WITHDRAWN') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Invalid offer transition from %s to %s',
        OLD."status",
        NEW."status"
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER offers_valid_status_transition
BEFORE UPDATE OF "status" ON "offers"
FOR EACH ROW EXECUTE FUNCTION validate_offer_status_transition();

CREATE OR REPLACE FUNCTION validate_accepted_request_consistency()
RETURNS trigger AS $$
DECLARE
  target_request_id UUID;
  target_request_status "request_status";
  accepted_offer_count INTEGER;
  pending_offer_count INTEGER;
BEGIN
  target_request_id := CASE
    WHEN TG_TABLE_NAME = 'offers' THEN NEW."request_id"
    ELSE NEW."id"
  END;

  SELECT "status"
    INTO target_request_status
    FROM "service_requests"
   WHERE "id" = target_request_id;

  SELECT
    count(*) FILTER (WHERE "status" = 'ACCEPTED'),
    count(*) FILTER (WHERE "status" = 'PENDING')
    INTO accepted_offer_count, pending_offer_count
    FROM "offers"
   WHERE "request_id" = target_request_id;

  IF target_request_status = 'ACCEPTED' THEN
    IF accepted_offer_count <> 1 OR pending_offer_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'An accepted request requires exactly one accepted offer and no pending offers';
    END IF;
  ELSIF accepted_offer_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'An accepted offer requires an accepted service request';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER offers_match_request_acceptance
AFTER INSERT OR UPDATE OF "status" ON "offers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_accepted_request_consistency();

CREATE CONSTRAINT TRIGGER service_requests_match_accepted_offer
AFTER UPDATE OF "status" ON "service_requests"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_accepted_request_consistency();
