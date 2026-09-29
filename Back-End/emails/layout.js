// Every email body is raw HTML built by hand (no templating engine that
// auto-escapes), and several fields that land in it are user-controlled
// (full name, bank details, a withdrawal destination address) — this stops
// something like a full name of `<img src=x onerror=...>` from being
// interpreted as markup by the recipient's mail client instead of shown as
// literal text.
const escapeHtml = (value) => {

    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

};

const wrap = ({ title, preheader = "", bodyHtml }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0e12;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0e12;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#151821;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#2563eb;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;">Anchor Exchange</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#e5e7eb;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #262a35;color:#6b7280;font-size:12px;">
              <p style="margin:0 0 6px;">Need help? Contact <a href="mailto:support@anchorexchange.com" style="color:#60a5fa;">support@anchorexchange.com</a></p>
              <p style="margin:0;">© ${new Date().getFullYear()} Anchor Exchange. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = { wrap, escapeHtml };
