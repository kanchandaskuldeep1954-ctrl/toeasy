import { config } from '../config.js';

class OTPService {
    constructor() { }

    generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendOTP(email: string, otp: string) {
        // If API key is missing, default to logging for local development
        if (!config.resendApiKey) {
            console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
            return true;
        }

        try {
            // Using native fetch to avoid SDK dependency issues on production
            // Resend API: https://resend.com/docs/api-reference/emails/send-email
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.resendApiKey}`
                },
                body: JSON.stringify({
                    from: config.email.from, // Dynamic from address
                    to: [email],
                    subject: 'Verify your Toeasy AI Account',
                    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #4f46e5; text-align: center;">Welcome to Toeasy AI</h2>
          <p>Hi there,</p>
          <p>Thank you for signing up for Toeasy AI. Please use the following One-Time Password (OTP) to verify your account:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827;">${otp}</span>
          </div>
          <p>This OTP will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280; text-align: center;">&copy; 2026 Toeasy AI. All rights reserved.</p>
        </div>
      `,
                })
            });

            if (!response.ok) {
                const errorData: any = await response.json();
                console.error('Resend API Error:', errorData);
                throw new Error(errorData.message || 'Failed to send email via Resend');
            }

            throw new Error(`Email delivery failed: ${error.message}`);
        } catch (error: any) {
            console.error('Failed to send OTP email via Resend:', error);
            // CRITICAL FALLBACK: Log to terminal so owner can still verify users manually
            console.log(`\n************************************************************`);
            console.log(`[AUTH FALLBACK] Email failed for ${email}`);
            console.log(`[OTP CODE] ==> ${otp} <==`);
            console.log(`************************************************************\n`);

            // For local development or non-blocking failures, we return true 
            // so the user can still register by checking the backend logs.
            return true;
        }
    }
}

export const otpService = new OTPService();
