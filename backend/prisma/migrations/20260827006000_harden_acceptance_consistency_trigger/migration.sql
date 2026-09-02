CREATE OR REPLACE FUNCTION validate_accepted_request_consistency()
RETURNS trigger AS $$
DECLARE
  target_request_id UUID;
  target_request_status "request_status";
  accepted_offer_count INTEGER;
  pending_offer_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'offers' THEN
    target_request_id := (to_jsonb(NEW) ->> 'request_id')::UUID;
  ELSE
    target_request_id := (to_jsonb(NEW) ->> 'id')::UUID;
  END IF;

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
