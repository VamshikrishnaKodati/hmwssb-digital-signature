const BLUE = '#17375E';
const ACCENT = '#0EA5E9';
const GREEN = '#059669';
const SLATE = '#64748B';
const BORDER = '#E2E8F0';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOtpEmailHtml({
  code,
  recipientName,
  estimateNo,
  workName,
  requestedBy,
  requestedByDesignation,
  dateTime,
  expiresInMinutes = 5,
  logoSrc = 'cid:hmwssb-logo',
}) {
  const logoImg = logoSrc
    ? `<img src="${logoSrc}" width="180" height="auto" alt="HMWSSB" title="HMWSSB" style="display:block;width:180px;height:auto;margin:0 auto;padding-bottom:14px;" />`
    : '';

  const detailRow = (label, value) => `
    <tr>
      <td style="padding:10px 18px;border-bottom:1px solid ${BORDER};font-size:12px;color:${SLATE};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;width:160px;">${esc(label)}</td>
      <td style="padding:10px 18px;border-bottom:1px solid ${BORDER};font-size:14px;color:#0F172A;font-weight:500;">${esc(value)}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>HMWSSB - OTP Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;-webkit-text-size-adjust:100%;word-spacing:normal;">
  <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your verification code for ${esc(estimateNo || 'the estimate')} is valid for ${esc(expiresInMinutes)} minutes.
  </span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);-webkit-box-shadow:0 4px 16px rgba(15,23,42,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BLUE};padding:28px 32px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${logoImg ? `<tr><td align="center" style="padding-bottom:4px;">${logoImg}</td></tr>` : ''}
                <tr>
                  <td align="center" style="font-size:18px;line-height:24px;color:#ffffff;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                    HMWSSB
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:#BFDBFE;font-family:Arial,Helvetica,sans-serif;padding-top:4px;">
                    Hyderabad Metropolitan Water Supply &amp; Sewerage Board
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:#7DD3FC;font-family:Arial,Helvetica,sans-serif;">
                    Works Management System
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size:22px;line-height:28px;color:#0F172A;font-weight:700;font-family:Arial,Helvetica,sans-serif;padding-bottom:6px;">
                    OTP Verification
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:13px;line-height:20px;color:${SLATE};font-family:Arial,Helvetica,sans-serif;padding-bottom:24px;">
                    One-Time Password for Digital Signature
                  </td>
                </tr>

                <tr>
                  <td style="font-size:14px;line-height:22px;color:#0F172A;font-family:Arial,Helvetica,sans-serif;">
                    Hello <strong style="color:${BLUE};">${esc(recipientName || 'User')}</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;line-height:22px;color:#334155;font-family:Arial,Helvetica,sans-serif;padding-top:8px;">
                    You requested to digitally sign and approve the following estimate. Use the verification code below to complete the signature.
                  </td>
                </tr>

                <!-- OTP Box -->
                <tr>
                  <td align="center" style="padding:28px 0 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:16px 36px;background-color:#EFF6FF;border:2px dashed ${ACCENT};border-radius:10px;">
                          <div style="font-size:13px;color:${SLATE};font-weight:600;text-align:center;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;padding-bottom:8px;">Your Verification Code</div>
                          <div style="font-size:36px;line-height:44px;color:${BLUE};font-weight:700;text-align:center;letter-spacing:0.35em;padding-left:0.35em;font-family:'Courier New',Courier,monospace;">${esc(code)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;line-height:18px;color:${GREEN};font-weight:600;font-family:Arial,Helvetica,sans-serif;padding-bottom:24px;">
                    This code is valid for ${esc(expiresInMinutes)} minutes only.
                  </td>
                </tr>

                <!-- Estimate Details -->
                <tr>
                  <td style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td colspan="2" style="padding:12px 18px;background-color:#F8FAFC;font-size:12px;color:${BLUE};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid ${BORDER};">Estimate Details</td>
                      </tr>
                      ${detailRow('Estimate No', estimateNo || '—')}
                      ${detailRow('Work Name', workName || '—')}
                      ${detailRow('Requested By', `${requestedBy || ''}${requestedByDesignation ? ` (${requestedByDesignation})` : ''}`)}
                      ${detailRow('Date &amp; Time', dateTime || '—')}
                    </table>
                  </td>
                </tr>

                <!-- Security Notice -->
                <tr>
                  <td style="padding:22px 18px 8px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:12px;line-height:20px;color:#92400E;font-family:Arial,Helvetica,sans-serif;">
                          <strong style="font-size:13px;">Security Notice</strong><br />
                          &bull; Never share this OTP with anyone, including HMWSSB staff.<br />
                          &bull; HMWSSB will <strong>never</strong> ask you for this code over phone, SMS, or email.<br />
                          &bull; If you did not request this verification, please ignore this email and contact your administrator.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:20px 32px;border-top:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:${SLATE};font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 HMWSSB Works Management System
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:${SLATE};font-family:Arial,Helvetica,sans-serif;padding-top:2px;">
                    This is an automated email. Please do not reply to this message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailText({
  code,
  recipientName,
  estimateNo,
  workName,
  requestedBy,
  requestedByDesignation,
  dateTime,
  expiresInMinutes = 5,
}) {
  return [
    'HMWSSB Works Management System',
    'OTP Verification for Digital Signature',
    '',
    `Hello ${recipientName || 'User'},`,
    '',
    'You requested to digitally sign and approve the following estimate. Use the verification code below to complete the signature.',
    '',
    `Your Verification Code: ${code}`,
    `This code is valid for ${expiresInMinutes} minutes only.`,
    '',
    'Estimate Details',
    `Estimate No : ${estimateNo || '—'}`,
    `Work Name   : ${workName || '—'}`,
    `Requested By: ${requestedBy || ''}${requestedByDesignation ? ` (${requestedByDesignation})` : ''}`,
    `Date & Time : ${dateTime || '—'}`,
    '',
    'Security Notice',
    '- Never share this OTP with anyone, including HMWSSB staff.',
    '- HMWSSB will never ask you for this code over phone, SMS, or email.',
    '- If you did not request this verification, please ignore this email.',
    '',
    'Regards,',
    'HMWSSB Works Management System',
    '(This is an automated email. Please do not reply.)',
  ].join('\n');
}

function buildWorkflowEmailHtml({
  recipientName,
  estimateNo,
  workName,
  action,
  fromUser,
  fromDesignation,
  remarks,
  dateTime,
  logoSrc = 'cid:hmwssb-logo',
}) {
  const logoImg = logoSrc
    ? `<img src="${logoSrc}" width="180" height="auto" alt="HMWSSB" title="HMWSSB" style="display:block;width:180px;height:auto;margin:0 auto;padding-bottom:14px;" />`
    : '';

  const detailRow = (label, value) => `
    <tr>
      <td style="padding:10px 18px;border-bottom:1px solid ${BORDER};font-size:12px;color:${SLATE};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;width:160px;">${esc(label)}</td>
      <td style="padding:10px 18px;border-bottom:1px solid ${BORDER};font-size:14px;color:#0F172A;font-weight:500;">${esc(value)}</td>
    </tr>`;

  const remarksRow = remarks ? `
    <tr>
      <td colspan="2" style="padding:10px 18px;border-bottom:1px solid ${BORDER};">
        <span style="font-size:12px;color:${SLATE};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Remarks</span>
        <p style="font-size:13px;color:#334155;margin:6px 0 0;white-space:pre-line;">${esc(remarks)}</p>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>HMWSSB - Workflow Update</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;-webkit-text-size-adjust:100%;word-spacing:normal;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
          <tr>
            <td style="background-color:${BLUE};padding:28px 32px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${logoImg ? `<tr><td align="center" style="padding-bottom:4px;">${logoImg}</td></tr>` : ''}
                <tr>
                  <td align="center" style="font-size:18px;line-height:24px;color:#ffffff;font-weight:700;font-family:Arial,Helvetica,sans-serif;">HMWSSB</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:#BFDBFE;font-family:Arial,Helvetica,sans-serif;padding-top:4px;">
                    Hyderabad Metropolitan Water Supply &amp; Sewerage Board
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:#7DD3FC;font-family:Arial,Helvetica,sans-serif;">
                    Works Management System
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size:22px;line-height:28px;color:#0F172A;font-weight:700;font-family:Arial,Helvetica,sans-serif;padding-bottom:6px;">
                    Workflow Update
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:13px;line-height:20px;color:${SLATE};font-family:Arial,Helvetica,sans-serif;padding-bottom:24px;">
                    Estimate workflow status notification
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;line-height:22px;color:#0F172A;font-family:Arial,Helvetica,sans-serif;">
                    Hello <strong style="color:${BLUE};">${esc(recipientName || 'User')}</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;line-height:22px;color:#334155;font-family:Arial,Helvetica,sans-serif;padding-top:8px;">
                    ${esc(action || 'An update has been made')} on the estimate below. Please review and take necessary action.
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;margin-top:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td colspan="2" style="padding:12px 18px;background-color:#F8FAFC;font-size:12px;color:${BLUE};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid ${BORDER};">Estimate Details</td>
                      </tr>
                      ${detailRow('Estimate No', estimateNo || '—')}
                      ${detailRow('Work Name', workName || '—')}
                      ${detailRow('Action', action || '—')}
                      ${detailRow('By', `${fromUser || 'System'}${fromDesignation ? ` (${fromDesignation})` : ''}`)}
                      ${detailRow('Date &amp; Time', dateTime || new Date().toLocaleString('en-IN'))}
                      ${remarksRow}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:20px 32px;border-top:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:${SLATE};font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 HMWSSB Works Management System
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;line-height:16px;color:${SLATE};font-family:Arial,Helvetica,sans-serif;padding-top:2px;">
                    This is an automated email. Please do not reply to this message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildWorkflowEmailText({
  recipientName,
  estimateNo,
  workName,
  action,
  fromUser,
  fromDesignation,
  remarks,
  dateTime,
}) {
  return [
    'HMWSSB Works Management System',
    'Workflow Update Notification',
    '',
    `Hello ${recipientName || 'User'},`,
    '',
    `${action || 'An update has been made'} on the estimate below. Please review and take necessary action.`,
    '',
    'Estimate Details',
    `Estimate No : ${estimateNo || '—'}`,
    `Work Name   : ${workName || '—'}`,
    `Action      : ${action || '—'}`,
    `By          : ${fromUser || 'System'}${fromDesignation ? ` (${fromDesignation})` : ''}`,
    `Date & Time : ${dateTime || new Date().toLocaleString('en-IN')}`,
    remarks ? `Remarks     : ${remarks}` : '',
    '',
    'Regards,',
    'HMWSSB Works Management System',
    '(This is an automated email. Please do not reply.)',
  ].filter(Boolean).join('\n');
}

module.exports = { buildOtpEmailHtml, buildOtpEmailText, buildWorkflowEmailHtml, buildWorkflowEmailText };
