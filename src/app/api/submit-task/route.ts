import { NextRequest, NextResponse } from "next/server";
import { submitTask, Task } from "@/lib/firebase/tasks";
import { getRoom } from "@/lib/firebase/firestore";
import { getUsersByUIDs } from "@/lib/firebase/users";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import nodemailer from "nodemailer";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export async function POST(req: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const { taskId, userId, content, fileUrl } = await req.json();

    if (!taskId || !userId || !content) {
      return NextResponse.json({ error: "Missing required fields: taskId, userId, content" }, { status: 400 });
    }

    await submitTask(taskId, userId, content, fileUrl);

    // Get task details
    const taskDoc = await getDoc(doc(db, "tasks", taskId));
    if (!taskDoc.exists()) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const taskData = taskDoc.data() as Task;
    const task = { ...taskData, id: taskDoc.id } as Task;

    // Get room
    const room = await getRoom(task.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Get other members
    const otherMembers = room.members.filter(id => id !== userId);
    if (otherMembers.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Get their profiles
    const profiles = await getUsersByUIDs(otherMembers);
    const emails = profiles
      .map((p) => p.email)
      .filter((e): e is string => typeof e === "string" && e.trim().length > 0);

    if (emails.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Generate email content
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      A team member has submitted their task. Write a polite email asking other members to provide feedback on this submission.

      Task: ${task.title}
      Submission: ${content}

      Email should request feedback on quality, collaboration, and timeliness.
      Return only the email body.
    `;

    const result = await model.generateContent(prompt);
    const emailBody = result.response.text();

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || "test_user",
        pass: process.env.SMTP_PASS || "test_pass",
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER || "noreply@taskmind.ai",
      to: emails,
      subject: `Feedback Required: ${task.title} Submission`,
      text: emailBody,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Submit task error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit task" }, { status: 500 });
  }
}