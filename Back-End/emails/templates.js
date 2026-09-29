const { wrap, escapeHtml } = require("./layout");

const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#2563eb;border-radius:9999px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;">${label}</a>
      </td>
    </tr>
  </table>
`;

const linkFallback = (href) => `
  <p style="word-break:break-all;color:#9ca3af;font-size:12px;">
    If the button above doesn't work, copy and paste this link into your browser:<br/>
    <a href="${href}" style="color:#60a5fa;">${href}</a>
  </p>
`;

const welcomeEmail = ({ fullName, verifyUrl }) => ({
  subject: "Welcome to Anchor Exchange — verify your email",
  html: wrap({
    title: "Welcome to Anchor Exchange",
    preheader: "Verify your email to activate your account.",
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Welcome, ${escapeHtml(fullName)}!</h2>
      <p>Thanks for creating an account with Anchor Exchange. Before you can start trading, please verify your email address.</p>
      ${button(verifyUrl, "Verify Email Address")}
      ${linkFallback(verifyUrl)}
      <p style="color:#9ca3af;font-size:13px;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
    `
  })
});

const passwordResetEmail = ({ fullName, resetUrl }) => ({
  subject: "Reset your Anchor Exchange password",
  html: wrap({
    title: "Reset your password",
    preheader: "Reset your Anchor Exchange password.",
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Password reset requested</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, we received a request to reset the password for your Anchor Exchange account.</p>
      ${button(resetUrl, "Reset Password")}
      ${linkFallback(resetUrl)}
      <p style="color:#9ca3af;font-size:13px;">This link expires in 30 minutes. If you did not request a password reset, please ignore this email — your password will not be changed, but consider securing your account if this happens repeatedly.</p>
    `
  })
});

const passwordChangedEmail = ({ fullName }) => ({
  subject: "Your Anchor Exchange password was changed",
  html: wrap({
    title: "Password changed",
    preheader: "Your password was just changed.",
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Password changed</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, this is a confirmation that the password for your Anchor Exchange account was just changed.</p>
      <p style="color:#f87171;font-size:13px;">If you did not make this change, please contact support immediately — your account may be compromised.</p>
    `
  })
});

const formatUsd = (value) => `$${Number(value).toFixed(2)}`;
const formatCrypto = (value) => `${Number(value).toFixed(8)}`;

const buyOrderEmail = ({ fullName, asset, cryptoAmount, price, fee, total, reference }) => ({
  subject: `Your Anchor Exchange purchase of ${asset} is complete`,
  html: wrap({
    title: "Buy order completed",
    preheader: `You bought ${formatCrypto(cryptoAmount)} ${escapeHtml(asset)}.`,
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Purchase completed</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, your order has been filled.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
        <tr><td style="color:#9ca3af;padding:4px 0;">You received</td><td style="text-align:right;">${formatCrypto(cryptoAmount)} ${escapeHtml(asset)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Price</td><td style="text-align:right;">${formatUsd(price)} / ${escapeHtml(asset)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Fee</td><td style="text-align:right;">${formatUsd(fee)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;font-weight:bold;">Total charged</td><td style="text-align:right;font-weight:bold;">${formatUsd(total)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Reference</td><td style="text-align:right;">${escapeHtml(reference)}</td></tr>
      </table>
      <p style="color:#9ca3af;font-size:13px;">This purchase is now reflected in your wallet.</p>
    `
  })
});

const sellOrderEmail = ({ fullName, asset, cryptoAmount, price, fee, receiveAmount, reference }) => ({
  subject: `Your Anchor Exchange sale of ${asset} is complete`,
  html: wrap({
    title: "Sell order completed",
    preheader: `You sold ${formatCrypto(cryptoAmount)} ${escapeHtml(asset)}.`,
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Sale completed</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, your order has been filled.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
        <tr><td style="color:#9ca3af;padding:4px 0;">You sold</td><td style="text-align:right;">${formatCrypto(cryptoAmount)} ${escapeHtml(asset)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Price</td><td style="text-align:right;">${formatUsd(price)} / ${escapeHtml(asset)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Fee</td><td style="text-align:right;">${formatUsd(fee)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;font-weight:bold;">You received</td><td style="text-align:right;font-weight:bold;">${formatUsd(receiveAmount)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Reference</td><td style="text-align:right;">${escapeHtml(reference)}</td></tr>
      </table>
      <p style="color:#9ca3af;font-size:13px;">The proceeds are now reflected in your USD wallet balance.</p>
    `
  })
});

const depositConfirmationEmail = ({ fullName, amount, fee, netAmount, method, reference }) => ({
  subject: "Your Anchor Exchange deposit is complete",
  html: wrap({
    title: "Deposit completed",
    preheader: `Your deposit of ${formatUsd(netAmount)} has landed in your wallet.`,
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Deposit completed</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, your fiat deposit has been confirmed and credited to your wallet.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
        <tr><td style="color:#9ca3af;padding:4px 0;">Payment method</td><td style="text-align:right;text-transform:capitalize;">${escapeHtml(method)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Amount</td><td style="text-align:right;">${formatUsd(amount)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Fee</td><td style="text-align:right;">${formatUsd(fee)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;font-weight:bold;">Credited to wallet</td><td style="text-align:right;font-weight:bold;">${formatUsd(netAmount)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Reference</td><td style="text-align:right;">${escapeHtml(reference)}</td></tr>
      </table>
    `
  })
});

const cryptoDepositConfirmationEmail = ({ fullName, asset, amount, network, txHash, reference }) => ({
  subject: `Your ${asset} deposit is complete`,
  html: wrap({
    title: "Crypto deposit completed",
    preheader: `Your deposit of ${formatCrypto(amount)} ${escapeHtml(asset)} has landed in your wallet.`,
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Deposit completed</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, your crypto deposit has been confirmed on-chain and credited to your wallet.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
        <tr><td style="color:#9ca3af;padding:4px 0;">Network</td><td style="text-align:right;">${escapeHtml(network)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;font-weight:bold;">Credited to wallet</td><td style="text-align:right;font-weight:bold;">${formatCrypto(amount)} ${escapeHtml(asset)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Transaction hash</td><td style="text-align:right;word-break:break-all;">${escapeHtml(txHash)}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Reference</td><td style="text-align:right;">${escapeHtml(reference)}</td></tr>
      </table>
    `
  })
});

const withdrawalConfirmationRequestEmail = ({ fullName, asset, amount, receiveAmount, destination, confirmUrl }) => ({
  subject: `Confirm your ${asset} withdrawal`,
  html: wrap({
    title: "Confirm your withdrawal",
    preheader: `Confirm your withdrawal of ${asset === "USD" ? formatUsd(amount) : formatCrypto(amount) + " " + escapeHtml(asset)}.`,
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Confirm your withdrawal</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, a withdrawal was requested on your Anchor Exchange account. For your security, it will not be processed until you confirm it below.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
        <tr><td style="color:#9ca3af;padding:4px 0;">Amount</td><td style="text-align:right;">${asset === "USD" ? formatUsd(amount) : `${formatCrypto(amount)} ${escapeHtml(asset)}`}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;font-weight:bold;">You'll receive</td><td style="text-align:right;font-weight:bold;">${asset === "USD" ? formatUsd(receiveAmount) : `${formatCrypto(receiveAmount)} ${escapeHtml(asset)}`}</td></tr>
        <tr><td style="color:#9ca3af;padding:4px 0;">Destination</td><td style="text-align:right;word-break:break-all;">${escapeHtml(destination)}</td></tr>
      </table>
      ${button(confirmUrl, "Confirm Withdrawal")}
      ${linkFallback(confirmUrl)}
      <p style="color:#f87171;font-size:13px;">This link expires in 15 minutes. If you did not request this withdrawal, do not click the link — contact support immediately, your account may be compromised.</p>
    `
  })
});

const withdrawalCompletedEmail = ({ fullName, asset, amount, txHash, reference }) => ({
  subject: `Your ${asset} withdrawal is complete`,
  html: wrap({
    title: "Withdrawal completed",
    preheader: `Your withdrawal of ${asset === "USD" ? formatUsd(amount) : formatCrypto(amount) + " " + escapeHtml(asset)} has been processed.`,
    bodyHtml: `
      <h2 style="color:#ffffff;margin-top:0;">Withdrawal completed</h2>
      <p>Hi ${escapeHtml(fullName) || "there"}, your withdrawal has been confirmed and processed.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
        <tr><td style="color:#9ca3af;padding:4px 0;font-weight:bold;">Amount sent</td><td style="text-align:right;font-weight:bold;">${asset === "USD" ? formatUsd(amount) : `${formatCrypto(amount)} ${escapeHtml(asset)}`}</td></tr>
        ${txHash ? `<tr><td style="color:#9ca3af;padding:4px 0;">Transaction hash</td><td style="text-align:right;word-break:break-all;">${escapeHtml(txHash)}</td></tr>` : ""}
        <tr><td style="color:#9ca3af;padding:4px 0;">Reference</td><td style="text-align:right;">${escapeHtml(reference)}</td></tr>
      </table>
    `
  })
});

module.exports = {
  welcomeEmail,
  passwordResetEmail,
  passwordChangedEmail,
  buyOrderEmail,
  sellOrderEmail,
  depositConfirmationEmail,
  cryptoDepositConfirmationEmail,
  withdrawalConfirmationRequestEmail,
  withdrawalCompletedEmail
};
