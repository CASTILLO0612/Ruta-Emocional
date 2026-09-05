CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "requested_ip" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_lifecycle_check" CHECK (
      "consumed_at" IS NULL OR "revoked_at" IS NULL
    ),
    CONSTRAINT "password_reset_tokens_expiry_check" CHECK (
      "expires_at" > "created_at"
    )
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
    ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx"
    ON "password_reset_tokens"("user_id", "expires_at");
CREATE INDEX "password_reset_tokens_expires_at_idx"
    ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
