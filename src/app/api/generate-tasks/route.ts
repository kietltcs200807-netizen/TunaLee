import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_CHUNK_SIZE = 12000; // characters, safe for model context

function splitTextIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of text.split(/\r?\n/)) {
    if (current.length + line.length + 1 > maxSize) {
      if (current.length) chunks.push(current);
      if (line.length > maxSize) {
        for (let i = 0; i < line.length; i += maxSize) {
          chunks.push(line.slice(i, i + maxSize));
        }
        current = "";
      } else {
        current = line;
      }
    } else {
      current += (current ? "\n" : "") + line;
    }
  }

  if (current.length) chunks.push(current);
  return chunks;
}

function cleanJsonText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```json")) text = text.slice(7);
  if (text.startsWith("```")) text = text.slice(3);
  if (text.endsWith("```")) text = text.slice(0, -3);
  return text.trim();
}

function parseTaskArray(raw: string): Array<{ [key: string]: unknown }> {
  try {
    const parsed = JSON.parse(cleanJsonText(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not parse task JSON", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    let GoogleGenerativeAI;
    try {
      ({ GoogleGenerativeAI } = await import("@google/generative-ai"));
    } catch (importError) {
      console.error("Failed to import GoogleGenerativeAI:", importError);
      return NextResponse.json({ error: "Failed to load AI SDK" }, { status: 500 });
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_actual_gemini_api_key_here") {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    let genAI;
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (genAIError) {
      console.error("Failed to create GoogleGenerativeAI:", genAIError);
      return NextResponse.json({ error: "Failed to initialize AI client" }, { status: 500 });
    }

    let model;
    try {
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
    } catch (modelError) {
      console.error("Failed to create Gemini model:", modelError);
      return NextResponse.json({ error: "Failed to initialize AI model" }, { status: 500 });
    }

    const body = await req.json();
    const { text, members, type, deadline } = body;

    if (!text || !members || !Array.isArray(members)) {
      return NextResponse.json({ error: "Missing required fields: text and members array" }, { status: 400 });
    }

    const chunks = splitTextIntoChunks(text, MAX_CHUNK_SIZE);
    const allTasks: Array<{ [key: string]: unknown }> = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkPrompt = `
          You are an expert AI project manager.
          Assign tasks from this part of the assignment and return only a JSON array.
          Members: ${members.join(", ")}.
          Task type: ${type || "assignment"} (presentation, assignment, or both).
          Deadline: ${deadline || "not specified"}.
          Output for this chunk ONLY and keep this JSON array format:
          [
            {"title":"...","description":"...","type":"${type || "assignment"}","assigneeId":"...","deadline":"${deadline || new Date().toISOString()}","estimatedHours": 1}
          ]

          Chunk ${i + 1}/${chunks.length} content below:
          ${chunks[i]}
        `;

        const result = await model.generateContent(chunkPrompt);
        const taskArray = parseTaskArray(result.response.text());
        if (taskArray.length > 0) {
          allTasks.push(...taskArray);
        }
      } catch (aiError) {
        console.error("AI generation error for chunk", i, aiError);
        // Continue with other chunks or return partial results
      }
    }

    return NextResponse.json({ tasks: allTasks });
  } catch (error) {
    console.error("Task generation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate tasks" }, { status: 500 });
  }
}
