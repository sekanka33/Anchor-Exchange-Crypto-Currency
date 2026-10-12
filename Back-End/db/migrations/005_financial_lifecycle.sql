-- Provider-driven lifecycle for deposits and withdrawals, bank beneficiaries,
-- idempotent provider events, and an administrator audit log.
-- Additive only: new columns are nullable or defaulted; no rows are rewritten.

-- Bank beneficiaries. The account number is encrypted at rest by the
-- application (AES-256-GCM, BENEFICIARY_ENCRYPTION_KEY); only the last four
-- digits and a keyed fingerprint (for duplicate detection) are stored in the clear.
CREATE TABLE bank_beneficiaries (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency varchar(10) NOT NULL,
    label varchar(60),
    account_holder varchar(100) NOT NULL,
    bank_name varchar(100) NOT NULL,
    branch_code varchar(20),
    account_type varchar(20),
    account_number_encrypted text NOT NULL,
    account_number_last4 varchar(4) NOT NULL,
    account_fingerprint char(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    archived_at timestamptz
);

CREATE UNIQUE INDEX uq_bank_beneficiaries_active
    ON bank_beneficiaries (user_id, currency, account_fingerprint) WHERE archived_at IS NULL;
CREATE INDEX idx_bank_beneficiaries_user ON bank_beneficiaries (user_id) WHERE archived_at IS NULL;

ALTER TABLE deposits
    ADD COLUMN provider varchar(40),
    ADD COLUMN provider_status varchar(40),
    ADD COLUMN instructions jsonb,
    ADD COLUMN failure_reason text,
    ADD COLUMN completed_at timestamptz;

-- A provider reference identifies exactly one deposit, and a chain
-- transaction output credits exactly one deposit.
CREATE UNIQUE INDEX uq_deposits_provider_reference
    ON deposits (provider_reference) WHERE provider_reference IS NOT NULL;
-- Superseded by the unique index above (same column, same predicate).
DROP INDEX IF EXISTS idx_deposits_provider_reference;
CREATE UNIQUE INDEX uq_deposits_chain_transfer
    ON deposits (network, tx_hash, deposit_address) WHERE type = 'CRYPTO' AND tx_hash IS NOT NULL;
CREATE UNIQUE INDEX uq_deposit_addresses_address
    ON deposit_addresses (network, address, COALESCE(memo, ''));

ALTER TABLE withdrawals
    ADD COLUMN idempotency_key varchar(100),
    ADD COLUMN provider varchar(40),
    ADD COLUMN provider_reference varchar(100),
    ADD COLUMN provider_status varchar(40),
    ADD COLUMN beneficiary_id integer REFERENCES bank_beneficiaries(id) ON DELETE SET NULL,
    ADD COLUMN memo varchar(100),
    ADD COLUMN failure_reason text,
    ADD COLUMN submitted_at timestamptz,
    ADD COLUMN completed_at timestamptz;

CREATE UNIQUE INDEX uq_withdrawals_idempotency
    ON withdrawals (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX uq_withdrawals_provider_reference
    ON withdrawals (provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_withdrawals_status ON withdrawals (status);
CREATE INDEX idx_deposits_status ON deposits (status);

-- Every provider callback (payment webhook, payout update, custody event) is
-- recorded once; a redelivered event id is recognised and not re-applied.
CREATE TABLE provider_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider varchar(40) NOT NULL,
    event_id varchar(200) NOT NULL,
    event_type varchar(60) NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT NOW(),
    processed_at timestamptz,
    outcome varchar(60),
    UNIQUE (provider, event_id)
);

-- Sensitive administrator actions. Append-only, like the ledger.
CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id integer REFERENCES users(id),
    actor_role varchar(20),
    action varchar(60) NOT NULL,
    target_type varchar(40),
    target_id varchar(64),
    reason text,
    before_state jsonb,
    after_state jsonb,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id);

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION append_only();
