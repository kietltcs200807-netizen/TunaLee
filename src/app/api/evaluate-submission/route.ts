import { NextRequest, NextResponse } from "next/server";
import { evaluateSubmission, Task } from "@/lib/firebase/tasks";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

const VERCEL_AI_API_KEY = process.env.VERCEL_AI_API_KEY;

export async function POST(req: NextRequest) {
  if (!VERCEL_AI_API_KEY) {
    return NextResponse.json({ error: "VERCEL_AI_API_KEY is not configured" }, { status: 500 });
  }
  try {
    const { taskId, submissionId, roomId } = await req.json();

    if (!taskId || !submissionId || !roomId) {
      return NextResponse.json({ error: "Missing required fields: taskId, submissionId, roomId" }, { status: 400 });
    }

    // Get task details
    const taskDoc = await getDoc(doc(db, "tasks", taskId));
    if (!taskDoc.exists()) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const task = { id: taskDoc.id, ...taskDoc.data() } as Task;

    // Find the submission
    const submission = task.submissions?.find(s => s.id === submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Use Vercel AI to evaluate based on task requirements
    const prompt = `
      Evaluate this task submission on multiple criteria for quality and completeness.

      Task: ${task.title}
      Description: ${task.description}
      Task Type: ${task.type || 'assignment'}

      Submission: ${submission.content}

      Evaluate based on the following criteria (each 1-10):
      - Finance Metrics: Accuracy of calculations (e.g. WACC, CAPM), data validity
      - Quality: Logical argument, relevance to subject knowledge
      - Soft Skills: Timeliness, collaboration, support for others

      Provide an overall score and detailed feedback.

      Return only a JSON object:
      {
        "score": number (1-10, overall quality),
        "financeMetrics": number (1-10),
        "quality": number (1-10),
        "softSkills": number (1-10),
        "comment": "brief evaluation comment"
      }
    `;

    const res = await fetch("https://api.vercel.ai/v1/ai/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VERCEL_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        max_output_tokens: 512,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Vercel AI failure", errorText);
      return NextResponse.json({ error: "Vercel AI request failed", details: errorText }, { status: 500 });
    }

    const aiData = await res.json();
    const aiText =
      aiData.output_text ||
      aiData.output?.[0]?.content?.[0]?.text ||
      aiData.choices?.[0]?.text ||
      "";

    const cleaned = aiText.replace(/```json|```/g, "").trim();
    const evaluation = JSON.parse(cleaned);

    // Save evaluation
    await evaluateSubmission(
      taskId,
      submissionId,
      "AI",
      evaluation.score,
      evaluation.comment,
      evaluation.financeMetrics,
      evaluation.quality,
      evaluation.softSkills
    );

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error("Evaluate submission error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to evaluate submission" }, { status: 500 });
  }
}