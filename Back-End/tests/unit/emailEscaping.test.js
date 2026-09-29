require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml } = require("../../emails/layout");
const templates = require("../../emails/templates");

const PAYLOADS = [`<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `' onmouseover='alert(1)`, `&lt;already&gt;`];

describe("escapeHtml", () => {
    test("escapes all five significant characters", () => {
        assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
    });

    test("null/undefined become empty string; numbers are stringified", () => {
        assert.equal(escapeHtml(null), "");
        assert.equal(escapeHtml(undefined), "");
        assert.equal(escapeHtml(0), "0");
    });

    test("does not double-escape ampersands incorrectly (escapes & first)", () => {
        assert.equal(escapeHtml("&lt;"), "&amp;lt;");
    });
});

describe("email templates never emit user-controlled markup", () => {
    // Every string-typed field is fed an attacker payload; the raw payload
    // (containing < > " ') must never appear in the HTML, only its escaped form.
    for (const payload of PAYLOADS) {
        test(`payload ${JSON.stringify(payload).slice(0, 34)} is inert in every template`, () => {
            const p = payload;
            const samples = {
                welcomeEmail: { fullName: p, verifyUrl: "https://x.test/v" },
                passwordResetEmail: { fullName: p, resetUrl: "https://x.test/r" },
                passwordChangedEmail: { fullName: p },
                buyOrderEmail: { fullName: p, asset: p, cryptoAmount: 1, price: 1, fee: 1, total: 1, reference: p },
                sellOrderEmail: { fullName: p, asset: p, cryptoAmount: 1, price: 1, fee: 1, receiveAmount: 1, reference: p },
                depositConfirmationEmail: { fullName: p, amount: 1, fee: 0, netAmount: 1, method: p, reference: p },
                cryptoDepositConfirmationEmail: { fullName: p, asset: p, amount: 1, network: p, txHash: p, reference: p },
                withdrawalConfirmationRequestEmail: { fullName: p, asset: p, amount: 1, receiveAmount: 1, destination: p, confirmUrl: "https://x.test/c" },
                withdrawalCompletedEmail: { fullName: p, asset: p, amount: 1, txHash: p, reference: p }
            };

            let checked = 0;
            for (const [name, args] of Object.entries(samples)) {
                if (typeof templates[name] !== "function") continue;
                const { html } = templates[name](args);
                checked++;
                assert.equal(html.includes(p) && /[<>"']/.test(p), false, `${name} emitted the raw payload`);
            }
            assert.ok(checked >= 6, "expected to exercise most templates");
        });
    }
});
