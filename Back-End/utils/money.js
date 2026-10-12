// Exact decimal arithmetic for money.
//
// JavaScript numbers are binary floats (0.1 + 0.2 !== 0.3), so they are never
// the authoritative representation of an amount. Amounts are BigInt counts of
// 10^-8 — the same scale as the database's numeric(28,8) columns — and are
// converted to/from decimal strings at the edges (request bodies, pg rows,
// JSON responses). pg returns numeric columns as strings, which parse exactly.

const SCALE = 8;
const ONE = 10n ** BigInt(SCALE);

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

const moneyError = (message) => Object.assign(new Error(message), { status: 400 });

// Decimal string for a JS number without exponent notation (1e-7 -> "0.0000001").
const numberToDecimalString = (value) =>
    value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });

// Parses a decimal string / finite number / BigInt units into BigInt units.
// `maxDecimals` rejects input more precise than the asset allows (e.g. 2 for
// fiat cents) instead of silently rounding it.
const toUnits = (value, { maxDecimals = SCALE, field = "Amount" } = {}) => {
    if (typeof value === "bigint") return value;

    let text;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw moneyError(`${field} must be a number`);
        text = numberToDecimalString(value);
    } else if (typeof value === "string") {
        text = value.trim();
    } else {
        throw moneyError(`${field} must be a number`);
    }

    const match = DECIMAL_PATTERN.exec(text);
    if (!match) throw moneyError(`${field} must be a number`);

    const [, sign, whole, fraction = ""] = match;
    const significant = fraction.replace(/0+$/, "");
    if (significant.length > maxDecimals) {
        throw moneyError(`${field} can have at most ${maxDecimals} decimal places`);
    }

    const units = BigInt(whole) * ONE + BigInt((significant + "0".repeat(SCALE)).slice(0, SCALE) || "0");
    return sign ? -units : units;
};

// Round to `decimals` places, half away from zero.
const roundUnits = (units, decimals) => {
    if (decimals >= SCALE) return units;
    const step = 10n ** BigInt(SCALE - decimals);
    const negative = units < 0n;
    const abs = negative ? -units : units;
    const rounded = ((abs + step / 2n) / step) * step;
    return negative ? -rounded : rounded;
};

// Round down (toward zero) to `decimals` places — used when the customer
// receives an amount, so rounding never favours them with money that
// doesn't exist.
const floorUnits = (units, decimals) => {
    if (decimals >= SCALE) return units;
    const step = 10n ** BigInt(SCALE - decimals);
    return (units / step) * step;
};

// BigInt units -> decimal string with exactly `decimals` places.
const toDecimalString = (units, decimals = SCALE) => {
    const rounded = roundUnits(units, decimals);
    const negative = rounded < 0n;
    const abs = negative ? -rounded : rounded;
    const whole = abs / ONE;
    const fraction = (abs % ONE).toString().padStart(SCALE, "0").slice(0, decimals);
    return `${negative ? "-" : ""}${whole}${decimals > 0 ? `.${fraction}` : ""}`;
};

// amount × rate, rounded half-up to `decimals` (e.g. a 1.5% fee in cents).
// `rate` is a decimal string or number like "0.015".
const applyRate = (units, rate, decimals = SCALE) => {
    const rateUnits = toUnits(rate, { field: "Rate" });
    return roundUnits((units * rateUnits) / ONE, decimals);
};

// a × b where both are unit amounts (e.g. quantity × price).
const multiply = (aUnits, bUnits, decimals = SCALE) => roundUnits((aUnits * bUnits) / ONE, decimals);

// a ÷ b, rounded down to `decimals` (e.g. how much crypto a fiat amount buys).
const divide = (aUnits, bUnits, decimals = SCALE) => {
    if (bUnits === 0n) throw new Error("Division by zero");
    return floorUnits((aUnits * ONE) / bUnits, decimals);
};

const isPositive = (units) => units > 0n;

module.exports = {
    SCALE,
    ONE,
    toUnits,
    toDecimalString,
    roundUnits,
    floorUnits,
    applyRate,
    multiply,
    divide,
    isPositive
};
