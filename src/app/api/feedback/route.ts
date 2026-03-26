import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, query, where, getDocs, type Query } from "firebase/firestore";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const roomId = url.searchParams.get("roomId");
    const taskId = url.searchParams.get("taskId");

    const feedbackRef = collection(db, "feedback");
    let queryRef: Query = feedbackRef;

    if (roomId) queryRef = query(feedbackRef, where("roomId", "==", roomId));
    if (taskId) queryRef = query(queryRef, where("taskId", "==", taskId));

    const feedbackSnapshot = await getDocs(queryRef);
    const items: Array<{ id: string; [key: string]: unknown }> = [];
    feedbackSnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ feedback: items });
  } catch (error) {
    console.error("Feedback GET error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch feedback" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { roomId, taskId, fromUid, targetUid, rating, comment } = await req.json();

    if (!roomId || !taskId || !fromUid || !targetUid || typeof rating !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await addDoc(collection(db, "feedback"), {
      roomId,
      taskId,
      fromUid,
      targetUid,
      rating,
      comment: comment || "",
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to submit feedback" }, { status: 500 });
  }
}
