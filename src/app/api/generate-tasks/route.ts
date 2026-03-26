import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfParse from "pdf-parse";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
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
  if (!genAI) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const { documentUrl, rawText, members, type, deadline } = await req.json();

    if ((!documentUrl && !rawText) || !members || members.length === 0) {
      return NextResponse.json({ error: "Missing source document (URL or text) or members list" }, { status: 400 });
    }

    let text = "";
    if (rawText) {
      text = String(rawText);
    } else {
      const fileRes = await fetch(documentUrl);
      const arrayBuffer = await fileRes.arrayBuffer();

      if (documentUrl.includes(".pdf") || documentUrl.includes("application%2Fpdf")) {
        const pdfData = await (pdfParse as any)(Buffer.from(arrayBuffer));
        text = pdfData.text;
      } else {
        text = Buffer.from(arrayBuffer).toString("utf-8");
      }
    }

    if (!text.trim()) {
      return NextResponse.json({ tasks: [] });
    }

    const chunks = splitTextIntoChunks(text, MAX_CHUNK_SIZE);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const allTasks: Array<{ [key: string]: unknown }> = [];

    for (let i = 0; i < chunks.length; i++) {
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
    }

    return NextResponse.json({ tasks: allTasks });
  } catch (error) {
    console.error("Task generation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate tasks" }, { status: 500 });
  }
}
