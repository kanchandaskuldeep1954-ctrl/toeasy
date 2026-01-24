import nodemailer from 'nodemailer';
import { config } from '../config.js';

class OTPService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.port === 465,
            auth: config.email.user ? {
                user: config.email.user,
                pass: config.email.pass,
            } : undefined,
            // Production readiness: shorter timeouts to prevent blocking API
            connectionTimeout: 15000, // 15s
            greetingTimeout: 10000,   // 10s
            socketTimeout: 15000,     // 15s
            debug: process.env.NODE_ENV !== 'production',
            logger: process.env.NODE_ENV !== 'production'
        });
    }

    generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendOTP(email: string, otp: string) {
        if (!config.email.user || !config.email.pass) {
            console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
            return true;
        }

        const mailOptions = {
            from: `"Toeasy AI" <${config.email.user}>`,
            to: email,
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
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error: any) {
            console.error('Failed to send OTP email:', error);
            if (error.code === 'ETIMEDOUT') {
                throw new Error('Connection to email server timed out. Check your SMTP settings and port.');
            }
            throw new Error(`Email delivery failed: ${error.message}`);
        }
    }
}

export const otpService = new OTPService();
