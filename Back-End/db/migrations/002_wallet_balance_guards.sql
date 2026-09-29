-- Last line of defence for the money invariants the application code already
-- enforces with row locks and `available_balance >= amount` guards: even a
-- future bug in a controller cannot drive a balance negative.
ALTER TABLE wallet_balances
    ADD CONSTRAINT wallet_balances_available_nonnegative CHECK (available_balance >= 0),
    ADD CONSTRAINT wallet_balances_locked_nonnegative CHECK (locked_balance >= 0);
