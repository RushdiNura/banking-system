import nodemailer from "nodemailer";

import { logger } from "./logger.js";

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
};

// Email templates
const emailTemplates = {
  verification: (data) => ({
    subject: "Verify Your Email",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${data.appName}!</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.name},</h2>
            <p>Thank you for registering with ${data.appName}. Please verify your email address to complete your registration.</p>
            <center>
              <a href="${data.verificationUrl}" class="button">Verify Email</a>
            </center>
            <p>This link will expire in 24 hours for security purposes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
            <div class="footer">
              <p>This is an automated message, please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} ${data.appName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordReset: (data) => ({
    subject: "Password Reset Request",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.name},</h2>
            <p>We received a request to reset your password for your ${data.appName} account.</p>
            <center>
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </center>
            <div class="warning">
              <strong>Security Notice:</strong> This link will expire in 30 minutes. If you didn't request a password reset, please contact our support team immediately.
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordResetSuccess: (data) => ({
    subject: "Password Reset Successful",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Password Changed Successfully</h1>
        <p>Hi ${data.name},</p>
        <p>Your password has been changed successfully.</p>
        <p>If you didn't make this change, please contact our support team immediately.</p>
      </div>
    `,
  }),

  loanApproved: (data) => ({
    subject: "Loan Application Approved",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Congratulations! Your Loan is Approved</h1>
        <p>Dear ${data.name},</p>
        <p>Your loan application for $${data.amount} has been approved.</p>
        <p>Loan Details:</p>
        <ul>
          <li>Loan Type: ${data.loanType}</li>
          <li>Amount: $${data.amount}</li>
          <li>Interest Rate: ${data.interestRate}%</li>
          <li>Term: ${data.term} months</li>
          <li>EMI: $${data.emi}</li>
        </ul>
      </div>
    `,
  }),
};

// Send email
export const sendEmail = async ({ email, subject, template, data }) => {
  try {
    const transporter = createTransporter();

    const emailContent = emailTemplates[template](data);

    const mailOptions = {
      from:
        process.env.SMTP_FROM || `"Banking System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject || emailContent.subject,
      html: emailContent.html,
    };

    // Add attachments if any
    if (data.attachments) {
      mailOptions.attachments = data.attachments;
    }

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent successfully to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email sending failed: ${error.message}`);
    throw new Error("Failed to send email");
  }
};

// Send bulk emails
export const sendBulkEmails = async (emails, subject, template, data) => {
  try {
    const transporter = createTransporter();

    const emailContent = emailTemplates[template](data);

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: emails,
      subject: subject || emailContent.subject,
      html: emailContent.html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Bulk email sent to ${emails.length} recipients`);
    return info;
  } catch (error) {
    logger.error(`Bulk email sending failed: ${error.message}`);
    throw new Error("Failed to send bulk emails");
  }
};

export default {
  sendEmail,
  sendBulkEmails,
};
