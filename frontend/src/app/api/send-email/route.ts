import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, html, secret } = body;

    // Verify secret to ensure only the backend can call this API
    const expectedSecret = process.env.INTERNAL_API_SECRET || "default_secret_key";
    if (!secret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
    const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
    const SMTP_USER = process.env.SMTP_USER || "";
    const SMTP_PASS = process.env.SMTP_PASS || "";
    const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@logistiq.vn";

    if (!SMTP_USER || !SMTP_PASS) {
      return NextResponse.json(
        { error: "SMTP credentials not configured on Vercel" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Vercel send-email route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
