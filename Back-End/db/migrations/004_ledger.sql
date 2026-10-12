-- Double-entry financial ledger.
--
-- Every movement of money is one journal (a business event, e.g. "deposit 42
-- credited") made of entries whose amounts sum to zero per asset. Accounts:
--   user:<id>:available / user:<id>:locked   a customer's balances
--   platform:fees                              fees the exchange earned
--   platform:trading                           the exchange's side of buys/sells
--   external:<provider>                        money entering/leaving the platform
--   platform:opening-balances                  balances that existed before this ledger
-- wallet_balances stays the fast read model; services/ledger.js updates it in
-- the same transaction as the entries, and reconciliation proves they agree.
--
-- Ledger rows reference users without ON DELETE CASCADE on purpose: a customer
-- with financial history can't be deleted (the records must be retained).

CREATE TABLE ledger_journals (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_key text NOT NULL UNIQUE,        -- idempotency: the same event can't be posted twice
    kind varchar(40) NOT NULL,
    reference_type varchar(40),
    reference_id bigint,
    description text,
    created_by integer REFERENCES users(id), -- set for administrator-initiated journals
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_entries (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_id bigint NOT NULL REFERENCES ledger_journals(id),
    account varchar(100) NOT NULL,
    user_id integer REFERENCES users(id),
    asset varchar(20) NOT NULL,
    amount numeric(28,8) NOT NULL CHECK (amount <> 0),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT ledger_entries_user_account CHECK ((account LIKE 'user:%') = (user_id IS NOT NULL))
);

CREATE INDEX idx_ledger_entries_journal ON ledger_entries (journal_id);
CREATE INDEX idx_ledger_entries_user_asset ON ledger_entries (user_id, asset) WHERE user_id IS NOT NULL;
CREATE INDEX idx_ledger_entries_account_asset ON ledger_entries (account, asset);
CREATE INDEX idx_ledger_journals_reference ON ledger_journals (reference_type, reference_id);

-- Double entry, enforced by the database: at commit, every journal must sum
-- to zero for each asset it touches.
CREATE FUNCTION ledger_assert_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    unbalanced text;
BEGIN
    SELECT asset INTO unbalanced
    FROM ledger_entries
    WHERE journal_id = NEW.journal_id
    GROUP BY asset
    HAVING SUM(amount) <> 0
    LIMIT 1;

    IF unbalanced IS NOT NULL THEN
        RAISE EXCEPTION 'Ledger journal % does not balance for %', NEW.journal_id, unbalanced;
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
    AFTER INSERT ON ledger_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ledger_assert_balanced();

-- Posted records are never edited or deleted; mistakes are fixed with a
-- correcting journal so the history stays auditable.
CREATE FUNCTION append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only; record a correcting entry instead', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER ledger_journals_append_only BEFORE UPDATE OR DELETE ON ledger_journals
    FOR EACH ROW EXECUTE FUNCTION append_only();
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION append_only();

-- Opening balances: one journal per existing non-zero balance, so the ledger
-- explains every unit already in wallet_balances. Existing rows are read,
-- never changed.
WITH source AS (
    SELECT wb.id, w.user_id, wb.asset_symbol, wb.available_balance, wb.locked_balance
    FROM wallet_balances wb
    JOIN wallets w ON w.id = wb.wallet_id
    WHERE w.user_id IS NOT NULL
      AND (wb.available_balance <> 0 OR wb.locked_balance <> 0)
),
journals AS (
    INSERT INTO ledger_journals (journal_key, kind, reference_type, reference_id, description)
    SELECT 'opening:wallet_balance:' || id, 'OPENING_BALANCE', 'wallet_balance', id,
           'Balance carried over when the ledger was introduced'
    FROM source
    RETURNING id, reference_id
)
INSERT INTO ledger_entries (journal_id, account, user_id, asset, amount)
SELECT j.id, 'user:' || s.user_id || ':available', s.user_id, s.asset_symbol, s.available_balance
FROM journals j JOIN source s ON s.id = j.reference_id WHERE s.available_balance <> 0
UNION ALL
SELECT j.id, 'user:' || s.user_id || ':locked', s.user_id, s.asset_symbol, s.locked_balance
FROM journals j JOIN source s ON s.id = j.reference_id WHERE s.locked_balance <> 0
UNION ALL
SELECT j.id, 'platform:opening-balances', NULL, s.asset_symbol, -(s.available_balance + s.locked_balance)
FROM journals j JOIN source s ON s.id = j.reference_id;
