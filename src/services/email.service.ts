import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
    static async sendVerificationEmail(email: string, token: string) {
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

        try {
            await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
                to: email,
                subject: 'Verify your email address',
                html: `
                    <h1>Welcome to DomainCal!</h1>
                    <p>Please click the button below to verify your email address:</p>
                    <a href="${verificationUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 16px 0;">
                        Verify Email
                    </a>
                    <p>Or copy and paste this link in your browser:</p>
                    <p>${verificationUrl}</p>
                    <p>If you did not create an account, please ignore this email.</p>
                `,
            });
        } catch (error) {
            console.error('Error sending verification email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    static async sendVerificationReminderEmail(email: string, token: string) {
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

        try {
            await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
                to: email,
                subject: 'Reminder: Verify your email address',
                html: `
                    <h1>Email Verification Reminder</h1>
                    <p>You haven't verified your email address yet. Please click the button below to verify:</p>
                    <a href="${verificationUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 16px 0;">
                        Verify Email
                    </a>
                    <p>Or copy and paste this link in your browser:</p>
                    <p>${verificationUrl}</p>
                    <p>If you did not create an account, please ignore this email.</p>
                `,
            });
        } catch (error) {
            console.error('Error sending verification reminder email:', error);
            throw new Error('Failed to send verification reminder email');
        }
    }
} 