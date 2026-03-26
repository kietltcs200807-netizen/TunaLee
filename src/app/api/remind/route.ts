import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export async function POST(req: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const { memberIds, memberEmails, roomName, tasks } = await req.json();

    const effectiveIds = Array.isArray(memberIds) && memberIds.length > 0 ? memberIds : [];
    const effectiveEmails = Array.isArray(memberEmails) && memberEmails.length > 0 ? memberEmails : [];

    if (effectiveIds.length === 0 && effectiveEmails.length === 0) {
      return NextResponse.json({ error: "No members specified" }, { status: 400 });
    }

    // 1. Generate email content using AI
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      You are an AI assistant helping a team leader write a professional reminder email.
      The team is working on the project: "${roomName}".
      The team members being emailed have the following pending tasks: ${JSON.stringify(tasks)}.
      
      Draft a polite but firm professional email reminding them of their tasks and deadlines.
      Return ONLY the email body. Start directly with the greeting.
    `;

    const result = await model.generateContent(prompt);
    const emailBody = result.response.text();

    // 2. Setup Nodemailer only for fallback path
    // (not used when Resend API key is present)
    // We will create transporter later in the block below.

    // 3. Resolve actual email addresses
    const predefined = effectiveEmails;
    const fromMemberIds = effectiveIds.map((id: string) =>
      id.includes("@") ? id : `user_${id.substring(0, 5)}@example.com`
    );
    const emailsToNotify = Array.from(new Set([...predefined, ...fromMemberIds]));

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      for (const email of emailsToNotify) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "AI Team Manager <noreply@aiteammanager.com>",
            to: email,
            subject: `Reminder: Tasks pending for ${roomName}`,
            text: emailBody,
          }),
        });
      }
    } else {
      // Fallback to Nodemailer for local/dev if SMTP env vars are configured
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER || "test_user",
          pass: process.env.SMTP_PASS || "test_pass",
        },
      });

      for (const email of emailsToNotify) {
        await transporter.sendMail({
          from: '"AI Team Manager" <noreply@aiteammanager.com>',
          to: email,
          subject: `Reminder: Tasks pending for ${roomName}`,
          text: emailBody,
        });
      }
    }

    return NextResponse.json({ success: true, message: "Reminders generated and sent" });
  } catch (error) {
    console.error("Reminder error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send reminders" }, { status: 500 });
  }
}
