CREATE OR REPLACE FUNCTION validate_request_status_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = NEW."status" THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('BIDDING', 'CANCELLED', 'EXPIRED'))
    OR (OLD."status" = 'BIDDING' AND NEW."status" IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED'))
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
