// Notification Service - Email and Push notifications
// Uses Resend for email (free tier: 100 emails/day)

import webpush from 'web-push';

// VAPID keys for Web Push (generate your own for production)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ736P1NJQWmfGeMacfYEhkxY';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

// Configure web-push
webpush.setVapidDetails(
  'mailto:alerts@lifi-agents.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export class NotificationService {
  
  // Send email via Resend API
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    data?: any
  ): Promise<void> {
    if (!RESEND_API_KEY) {
      console.log('[Notifications] Email skipped (no API key):', subject);
      return;
    }
    
    try {
      const htmlContent = this.generateEmailHtml(subject, body, data);
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'LI.FI Agents <alerts@lifi-agents.app>',
          to: [to],
          subject: subject,
          html: htmlContent,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }
      
      console.log(`[Notifications] Email sent to ${to}: ${subject}`);
      
    } catch (error: any) {
      console.error('[Notifications] Email error:', error.message);
    }
  }
  
  // Send Web Push notification
  async sendPush(
    subscription: PushSubscription,
    title: string,
    body: string
  ): Promise<void> {
    try {
      const payload = JSON.stringify({
        title,
        body,
        icon: '/lifi-icon.png',
        badge: '/lifi-badge.png',
        timestamp: Date.now(),
        actions: [
          { action: 'view', title: 'View Details' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      });
      
      await webpush.sendNotification(subscription as any, payload);
      console.log(`[Notifications] Push sent: ${title}`);
      
    } catch (error: any) {
      console.error('[Notifications] Push error:', error.message);
      
      // If subscription is invalid, it should be removed
      if (error.statusCode === 410) {
        console.log('[Notifications] Subscription expired, should be removed');
      }
    }
  }
  
  // Generate HTML email template
  private generateEmailHtml(title: string, body: string, data?: any): string {
    const isYield = title.includes('Yield');
    const isArbitrage = title.includes('Arbitrage');
    
    let detailsHtml = '';
    if (data) {
      if (isYield) {
        detailsHtml = `
          <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <table style="width: 100%; color: #fff;">
              <tr>
                <td style="color: #888;">Protocol</td>
                <td style="text-align: right; font-weight: bold;">${data.protocol}</td>
              </tr>
              <tr>
                <td style="color: #888;">Chain</td>
                <td style="text-align: right;">${data.chainName}</td>
              </tr>
              <tr>
                <td style="color: #888;">Token</td>
                <td style="text-align: right;">${data.token}</td>
              </tr>
              <tr>
                <td style="color: #888;">APY</td>
                <td style="text-align: right; color: #00ff88; font-size: 18px; font-weight: bold;">${data.apy?.toFixed(2)}%</td>
              </tr>
              <tr>
                <td style="color: #888;">TVL</td>
                <td style="text-align: right;">$${(data.tvl / 1000000).toFixed(2)}M</td>
              </tr>
            </table>
          </div>
        `;
      } else if (isArbitrage) {
        detailsHtml = `
          <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <table style="width: 100%; color: #fff;">
              <tr>
                <td style="color: #888;">Token</td>
                <td style="text-align: right; font-weight: bold;">${data.tokenSymbol}</td>
              </tr>
              <tr>
                <td style="color: #888;">Route</td>
                <td style="text-align: right;">${data.fromChain} → ${data.toChain}</td>
              </tr>
              <tr>
                <td style="color: #888;">Price Spread</td>
                <td style="text-align: right; color: #00d4ff;">${data.priceDifference?.toFixed(2)}%</td>
              </tr>
              <tr>
                <td style="color: #888;">Est. Profit</td>
                <td style="text-align: right; color: #00ff88; font-size: 18px; font-weight: bold;">$${data.profitAfterFees?.toFixed(2)}</td>
              </tr>
            </table>
          </div>
        `;
      }
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #00ff88 0%, #00d4ff 100%); padding: 12px 24px; border-radius: 8px;">
        <span style="color: #000; font-weight: bold; font-size: 18px;">🤖 LI.FI AGENTS</span>
      </div>
    </div>
    
    <!-- Main Card -->
    <div style="background: linear-gradient(180deg, #16162a 0%, #0d0d1a 100%); border: 1px solid #2a2a4a; border-radius: 16px; padding: 32px; color: #fff;">
      
      <!-- Title -->
      <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #fff;">
        ${title}
      </h1>
      
      <!-- Body -->
      <p style="margin: 0; color: #aaa; font-size: 16px; line-height: 1.6;">
        ${body}
      </p>
      
      <!-- Details -->
      ${detailsHtml}
      
      <!-- CTA Button -->
      <div style="margin-top: 24px; text-align: center;">
        <a href="http://localhost:3000" style="display: inline-block; background: linear-gradient(135deg, #00ff88 0%, #00d4ff 100%); color: #000; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Open Dashboard →
        </a>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
      <p>You're receiving this because you enabled alerts for your wallet.</p>
      <p>
        <a href="http://localhost:3000/settings" style="color: #00ff88;">Manage Preferences</a>
        &nbsp;•&nbsp;
        <a href="http://localhost:3000/unsubscribe" style="color: #888;">Unsubscribe</a>
      </p>
    </div>
    
  </div>
</body>
</html>
    `;
  }
  
  // Get VAPID public key (for client-side push subscription)
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }
}
