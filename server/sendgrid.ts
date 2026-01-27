import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  // Check if using standard environment variables (Docker/production)
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    return {
      apiKey: process.env.SENDGRID_API_KEY,
      email: process.env.SENDGRID_FROM_EMAIL
    };
  }

  // Otherwise use Replit connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables or use Replit connector.');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export async function sendUserInviteEmail(toEmail: string, inviteToken: string, inviterName: string, baseUrl?: string) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    // Construct the invite URL
    // Use provided baseUrl from request, or fall back to environment detection
    const finalBaseUrl = baseUrl || (
      process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : `http://localhost:${process.env.PORT || 5000}`
    );
    
    const inviteUrl = `${finalBaseUrl}/accept-invite?token=${inviteToken}`;
    
    const msg = {
      to: toEmail,
      from: fromEmail,
      subject: 'You\'ve been invited to Promissio Rights Management',
      text: `
Hello,

${inviterName} has invited you to join Promissio Rights Management System.

Click the link below to accept your invitation and set up your account:
${inviteUrl}

This invitation link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
Promissio Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, hsl(215, 25%, 15%) 0%, hsl(215, 25%, 20%) 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 30px; background: hsl(195, 100%, 45%); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: hsl(195, 100%, 40%); }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Promissio Rights Management</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to join the Promissio Rights Management System.</p>
      <p>Click the button below to accept your invitation and set up your account:</p>
      <p style="text-align: center;">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
      <p><em>This invitation link will expire in 7 days.</em></p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Promissio Rights Management. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    };

    await client.send(msg);
    console.log(`Invite email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending invite email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string, baseUrl?: string) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    // Construct the reset URL
    // Use provided baseUrl from request, or fall back to environment detection
    const finalBaseUrl = baseUrl || (
      process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : `http://localhost:${process.env.PORT || 5000}`
    );
    
    const resetUrl = `${finalBaseUrl}/reset-password?token=${resetToken}`;
    
    const msg = {
      to: toEmail,
      from: fromEmail,
      subject: 'Reset Your Promissio Password',
      text: `
Hello,

A password reset has been requested for your Promissio Rights Management account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 24 hours.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
Promissio Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, hsl(215, 25%, 15%) 0%, hsl(215, 25%, 20%) 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 30px; background: hsl(195, 100%, 45%); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: hsl(195, 100%, 40%); }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Promissio Rights Management</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>A password reset has been requested for your Promissio Rights Management account.</p>
      <p>Click the button below to reset your password:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p><em>This link will expire in 24 hours.</em></p>
      <p>If you didn't request this password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Promissio Rights Management. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    };

    await client.send(msg);
    console.log(`Password reset email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

interface RoyaltyStatementData {
  partner: string;
  recipientEmail: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalRevenue: number;
    totalRoyalties: number;
    paidRoyalties: number;
    pendingRoyalties: number;
    transactionCount: number;
  };
  royalties: {
    period: string;
    revenue: string;
    royaltyAmount: string;
    status: string;
    contractContent: string;
  }[];
}

export async function sendRoyaltyStatement(data: RoyaltyStatementData) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const formatCurrency = (amount: number) => 
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    
    const periodLabel = data.periodStart && data.periodEnd 
      ? `${data.periodStart} to ${data.periodEnd}`
      : data.periodStart || data.periodEnd || 'All Time';
    
    const royaltyRows = data.royalties.map(r => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${r.period}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${r.contractContent || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(parseFloat(r.revenue || '0'))}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(parseFloat(r.royaltyAmount || '0'))}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${r.status}</td>
      </tr>
    `).join('');
    
    const msg = {
      to: data.recipientEmail,
      from: fromEmail,
      subject: `Royalty Statement - ${data.partner} - ${periodLabel}`,
      text: `
Royalty Statement for ${data.partner}
Period: ${periodLabel}
Generated: ${new Date().toLocaleDateString()}

Summary:
- Total Revenue: ${formatCurrency(data.summary.totalRevenue)}
- Total Royalties: ${formatCurrency(data.summary.totalRoyalties)}
- Paid: ${formatCurrency(data.summary.paidRoyalties)}
- Outstanding: ${formatCurrency(data.summary.pendingRoyalties)}
- Transactions: ${data.summary.transactionCount}

This statement was generated by Promissio Rights Management System.
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, hsl(215, 25%, 15%) 0%, hsl(215, 25%, 20%) 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f9f9f9; padding: 15px; border-radius: 6px; text-align: center; }
    .summary-card.green { background: #d4edda; }
    .summary-card.amber { background: #fff3cd; }
    .summary-label { font-size: 12px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: 20px; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f0f0f0; padding: 12px 10px; text-align: left; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f9f9f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Royalty Statement</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Promissio Rights Management</p>
    </div>
    <div class="content">
      <div style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 5px 0;">${data.partner}</h2>
        <p style="color: #666; margin: 0;">Period: ${periodLabel}</p>
        <p style="color: #666; margin: 5px 0 0 0;">Generated: ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Revenue</div>
          <div class="summary-value">${formatCurrency(data.summary.totalRevenue)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Royalties</div>
          <div class="summary-value">${formatCurrency(data.summary.totalRoyalties)}</div>
        </div>
        <div class="summary-card green">
          <div class="summary-label">Paid</div>
          <div class="summary-value" style="color: #155724;">${formatCurrency(data.summary.paidRoyalties)}</div>
        </div>
        <div class="summary-card amber">
          <div class="summary-label">Outstanding</div>
          <div class="summary-value" style="color: #856404;">${formatCurrency(data.summary.pendingRoyalties)}</div>
        </div>
      </div>
      
      <h3 style="margin-top: 30px;">Transaction Details</h3>
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Content</th>
            <th style="text-align: right;">Revenue</th>
            <th style="text-align: right;">Royalty</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${royaltyRows || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #666;">No transactions found</td></tr>'}
        </tbody>
        <tfoot>
          <tr style="background: #f0f0f0; font-weight: bold;">
            <td colspan="2" style="padding: 12px 10px;">Total</td>
            <td style="padding: 12px 10px; text-align: right;">${formatCurrency(data.summary.totalRevenue)}</td>
            <td style="padding: 12px 10px; text-align: right;">${formatCurrency(data.summary.totalRoyalties)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Promissio Rights Management. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    };

    await client.send(msg);
    console.log(`Royalty statement sent to ${data.recipientEmail} for partner ${data.partner}`);
    return true;
  } catch (error) {
    console.error('Error sending royalty statement:', error);
    throw error;
  }
}
