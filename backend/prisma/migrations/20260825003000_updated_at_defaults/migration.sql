-- Keep timestamps correct when PostgreSQL is accessed outside Prisma (ETL, scripts, or audits).
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "patient_profiles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "psychologist_profiles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "service_requests" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "offers" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "appointments" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER patient_profiles_set_updated_at
BEFORE UPDATE ON "patient_profiles"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER psychologist_profiles_set_updated_at
BEFORE UPDATE ON "psychologist_profiles"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER service_requests_set_updated_at
BEFORE UPDATE ON "service_requests"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER offers_set_updated_at
BEFORE UPDATE ON "offers"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON "appointments"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON "payments"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
