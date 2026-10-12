const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const money = require("../../utils/money");

const { toUnits, toDecimalString, applyRate, multiply, divide, floorUnits } = money;

describe("money: exact decimal arithmetic", () => {
    test("parses decimal strings, numbers and pg numeric strings exactly", () => {
        assert.equal(toUnits("0.1") + toUnits("0.2"), toUnits("0.3"), "0.1 + 0.2 must equal 0.3 exactly");
        assert.equal(toUnits(0.1), 10000000n);
        assert.equal(toUnits("1500.00000000"), 150000000000n);
        assert.equal(toUnits(1e-7), 10n);
        assert.equal(toUnits("-2.5"), -250000000n);
    });

    test("rejects garbage and over-precise input instead of rounding it", () => {
        for (const bad of ["", "abc", "1e5", "1.2.3", " ", null, undefined, {}, NaN, Infinity]) {
            assert.throws(() => toUnits(bad), /must be a number/, String(bad));
        }
        assert.throws(() => toUnits("10.001", { maxDecimals: 2 }), /at most 2 decimal places/);
        assert.equal(toUnits("10.100", { maxDecimals: 2 }), toUnits("10.1"), "trailing zeros are fine");
        assert.throws(() => toUnits("0.000000001"), /at most 8 decimal places/);
    });

    test("formats with a fixed number of places, rounding half away from zero", () => {
        assert.equal(toDecimalString(toUnits("12.345"), 2), "12.35");
        assert.equal(toDecimalString(toUnits("-12.345"), 2), "-12.35");
        assert.equal(toDecimalString(toUnits("0.5"), 0), "1");
        assert.equal(toDecimalString(toUnits("3")), "3.00000000");
    });

    test("fees: amount × rate rounded to cents", () => {
        assert.equal(toDecimalString(applyRate(toUnits("100"), "0.015", 2), 2), "1.50");
        assert.equal(toDecimalString(applyRate(toUnits("33.33"), "0.01", 2), 2), "0.33");
        assert.equal(toDecimalString(applyRate(toUnits("0.10"), "0.015", 2), 2), "0.00");
    });

    test("quantity × price and fiat ÷ price never invent money", () => {
        assert.equal(toDecimalString(multiply(toUnits("0.5"), toUnits("83923.41"), 2), 2), "41961.71");
        // 100 / 3 rounds DOWN so the customer never receives more than was paid for.
        assert.equal(toDecimalString(divide(toUnits("100"), toUnits("3"))), "33.33333333");
        assert.equal(toDecimalString(floorUnits(toUnits("9.999"), 2), 2), "9.99");
        assert.throws(() => divide(toUnits("1"), 0n), /Division by zero/);
    });
});
