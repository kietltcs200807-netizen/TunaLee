import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { taskTitle, taskDescription, startDate, endDate, attendees, roomName } = await req.json();

    if (!taskTitle || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const bearerToken = process.env.GOOGLE_CALENDAR_BEARER_TOKEN;

    if (!calendarId || !bearerToken) {
      return NextResponse.json({ error: "Google Calendar credentials not configured" }, { status: 501 });
    }

    const event = {
      summary: `${roomName || "Team Project"}: ${taskTitle}`,
      description: taskDescription || "",
      start: { date: startDate },
      end: { date: endDate },
      attendees: (Array.isArray(attendees) ? attendees : []).map((email: string) => ({ email })),
    };

    const gcalRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(event),
    });

    if (!gcalRes.ok) {
      const text = await gcalRes.text();
      console.error("Google Calendar API error:", text);
      return NextResponse.json({ error: "Failed to create calendar event", details: text }, { status: 500 });
    }

    const data = await gcalRes.json();
    return NextResponse.json({ success: true, event: data });
  } catch (error) {
    console.error("Calendar POST error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create calendar event" }, { status: 500 });
  }
}
