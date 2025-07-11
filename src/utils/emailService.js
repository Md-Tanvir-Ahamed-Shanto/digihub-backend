// src/utils/emailService.js
const nodemailer = require('nodemailer');
// Ensure dotenv is configured at the very top of your application's entry point (e.g., app.js or server.js)
// require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
    }
});

/**
 * Sends a generic verification email (e.g., for direct client registration).
 * @param {string} toEmail - The recipient's email address.
 * @param {string} verificationLink - The URL the user clicks to verify their account.
 * @param {string} userName - The name of the user.
 */
exports.sendVerificationEmail = async (toEmail, verificationLink, userName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DGHUB Support" <support@yourdomain.com>',
            to: toEmail,
            subject: 'Verify Your DGHUB Account',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://example.com/your-logo.png" alt="DGHUB Logo" style="max-width: 150px; height: auto;">
                        <h2 style="color: #0056b3;">Welcome to DGHUB!</h2>
                    </div>
                    <p>Hello <strong>${userName}</strong>,</p>
                    <p>Thank you for creating an account with DGHUB. To activate your account and get started, please verify your email address by clicking the button below:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}" style="display: inline-block; padding: 12px 25px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Verify My Email
                        </a>
                    </p>
                    <p>This verification link will expire in 24 hours for security reasons.</p>
                    <p>If you did not create this account, please ignore this email. Your account will not be activated.</p>
                    <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; font-size: 0.9em; color: #777;">
                        <p>&copy; ${new Date().getFullYear()} DGHUB. All rights reserved.</p>
                        <p>If you have any questions, feel free to contact our <a href="mailto:${process.env.EMAIL_FROM}" style="color: #007bff; text-decoration: none;">support team</a>.</p>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${toEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`Error sending verification email to ${toEmail}:`, error);
        throw new Error('Failed to send verification email. Please check server logs.');
    }
};

/**
 * Sends an email to a new client to set their password and activate their account after lead submission.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} setPasswordLink - The URL the user clicks to set their password.
 * @param {string} userName - The name of the user.
 */
exports.sendSetPasswordEmail = async (toEmail, setPasswordLink, userName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DGHUB Support" <support@yourdomain.com>',
            to: toEmail,
            subject: 'Complete Your DGHUB Account Setup',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://example.com/your-logo.png" alt="DGHUB Logo" style="max-width: 150px; height: auto;">
                        <h2 style="color: #0056b3;">Welcome to DGHUB!</h2>
                    </div>
                    <p>Hello <strong>${userName}</strong>,</p>
                    <p>Thank you for submitting your project quote with DGHUB. We've created an account for you. To complete your account setup and get started, please click the link below to set your password:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${setPasswordLink}" style="display: inline-block; padding: 12px 25px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Set My Password & Activate Account
                        </a>
                    </p>
                    <p>This link will expire in 24 hours for security reasons.</p>
                    <p>If you did not submit a project quote, please ignore this email.</p>
                    <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; font-size: 0.9em; color: #777;">
                        <p>&copy; ${new Date().getFullYear()} DGHUB. All rights reserved.</p>
                        <p>If you have any questions, feel free to contact our <a href="mailto:${process.env.EMAIL_FROM}" style="color: #28a745; text-decoration: none;">support team</a>.</p>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Set Password email sent to ${toEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`Error sending set password email to ${toEmail}:`, error);
        throw new Error('Failed to send set password email. Please check server logs.');
    }
};

/**
 * Sends an email to a new partner to set their password and activate their account.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} setPasswordLink - The URL the partner clicks to set their password.
 * @param {string} partnerName - The name of the partner.
 */
exports.sendPartnerSetPasswordEmail = async (toEmail, setPasswordLink, partnerName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DGHUB Support" <support@yourdomain.com>',
            to: toEmail,
            subject: 'Welcome to DGHUB! Set Up Your Partner Account',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://example.com/your-logo.png" alt="DGHUB Logo" style="max-width: 150px; height: auto;">
                        <h2 style="color: #0056b3;">Welcome to DGHUB Partner Network!</h2>
                    </div>
                    <p>Hello <strong>${partnerName}</strong>,</p>
                    <p>A DGHUB administrator has created a partner account for you. To activate your dashboard and begin accepting projects, please click the link below to set your password:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${setPasswordLink}" style="display: inline-block; padding: 12px 25px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Set My Partner Password & Activate Account
                        </a>
                    </p>
                    <p>This link will expire in 24 hours for security reasons.</p>
                    <p>If you believe this email was sent in error, please ignore it.</p>
                    <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; font-size: 0.9em; color: #777;">
                        <p>&copy; ${new Date().getFullYear()} DGHUB. All rights reserved.</p>
                        <p>If you have any questions, feel free to contact our <a href="mailto:${process.env.EMAIL_FROM}" style="color: #007bff; text-decoration: none;">support team</a>.</p>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Partner set password email sent to ${toEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`Error sending partner set password email to ${toEmail}:`, error);
        throw new Error('Failed to send partner set password email. Please check server logs.');
    }
};