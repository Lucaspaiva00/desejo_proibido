// src/utils/email.js
import nodemailer from "nodemailer";

export function isSmtpConfigured() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return !!(host && user && pass);
}

export function getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error("SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)");
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

export async function sendEmail({ to, subject, html }) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const transporter = getTransporter();

    await transporter.sendMail({
        from,
        to,
        subject,
        html,
    });
}
