import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRoom } from "@/lib/firebase/firestore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAQH99wT9humD2T-oE1eXuYEAOix6Q-ssM";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { message, roomId, history } = await req.json();

    if (!message || !roomId) {
      return NextResponse.json({ error: "Missing required fields: message, roomId" }, { status: 400 });
    }

    // Get room information
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build context from chat history
    const context = history ? history.map((h: { role: string; content: string }) => `${h.role}: ${h.content}`).join('\n') : '';

    const prompt = `
      You are an AI assignment creation assistant for a team project management system.

      Room: ${room.name}
      Course: ${room.course}
      Team members: ${room.members.length}

      Previous conversation:
      ${context}

      User message: ${message}

      Based on the conversation, determine if the user wants you to create assignments. If they do, generate a JSON array of assignments with this format:
      [
        {
          "id": "unique_id",
          "title": "Assignment Title",
          "description": "Detailed description of what needs to be done",
          "type": "assignment|presentation|both",
          "assignedMembers": []
        }
      ]

      If the user is just asking questions or providing information without requesting assignment creation, respond with helpful information about assignment creation.

      If creating assignments, respond with both a natural language response and the assignments JSON.
      If not creating assignments, just respond with natural language.

      Response format:
      {
        "response": "Your natural language response here",
        "assignments": [assignment objects] or null
      }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response.replace(/```json|```/g, "").trim());
      return NextResponse.json(parsed);
    } catch {
      // If not JSON, return as plain response
      return NextResponse.json({
        response: response.replace(/```json|```/g, "").trim(),
        assignments: null
      });
    }

  } catch (error) {
    console.error("Chat assignment error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to process chat message",
      response: "Sorry, I encountered an error. Please try again.",
      assignments: null
    }, { status: 500 });
  }
}