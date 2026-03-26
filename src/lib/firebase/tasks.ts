import { db } from "./config";
import { collection, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, arrayUnion } from "firebase/firestore";

export interface Task {
  id: string;
  roomId: string;
  title: string;
  description: string;
  assigneeId: string; // user ID
  assigneeName?: string; // string or generic names for now
  deadline: string; // ISO string for date and time
  status: "todo" | "in-progress" | "done";
  createdAt: any;
  type: "assignment" | "project" | "quiz" | "discussion" | "presentation" | "both";
  submissions?: Submission[]; // new field
  evaluations?: Evaluation[]; // new field
}

export interface Submission {
  id: string;
  userId: string;
  submittedAt: any; // serverTimestamp
  content: string; // submission text or file URL
  fileUrl?: string; // if file uploaded
}

export interface Evaluation {
  id: string;
  submissionId: string;
  evaluatorId: string; // AI or leader
  score: number; // 1-10
  financeMetrics?: number; // 1-10
  quality?: number; // 1-10
  softSkills?: number; // 1-10
  relevance?: number; // 1-10, for backward compatibility
  comment: string;
  evaluatedAt: any;
}

export const createTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "tasks"), {
      ...taskData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
};

export const updateTaskStatus = async (taskId: string, status: Task["status"]) => {
  try {
    const docRef = doc(db, "tasks", taskId);
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error("Error updating task status:", error);
    throw error;
  }
};

export const updateTask = async (taskId: string, updates: Partial<Omit<Task, "id" | "createdAt">>) => {
  try {
    const docRef = doc(db, "tasks", taskId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error("Error updating task:", error);
    throw error;
  }
};

export const deleteTask = async (taskId: string) => {
  try {
    const docRef = doc(db, "tasks", taskId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
};

export const submitTask = async (taskId: string, userId: string, content: string, fileUrl?: string) => {
  try {
    const docRef = doc(db, "tasks", taskId);
    const submission = {
      id: `${userId}_${Date.now()}`,
      userId,
      submittedAt: serverTimestamp(),
      content,
      fileUrl,
    };
    await updateDoc(docRef, {
      submissions: arrayUnion(submission),
      status: "done", // mark as done when submitted
    });
  } catch (error) {
    console.error("Error submitting task:", error);
    throw error;
  }
};

export const evaluateSubmission = async (taskId: string, submissionId: string, evaluatorId: string, score: number, comment: string, financeMetrics?: number, quality?: number, softSkills?: number) => {
  try {
    const docRef = doc(db, "tasks", taskId);
    const evaluation: any = {
      id: `${submissionId}_${Date.now()}`,
      submissionId,
      evaluatorId,
      score,
      comment,
      evaluatedAt: serverTimestamp(),
    };
    if (financeMetrics !== undefined) evaluation.financeMetrics = financeMetrics;
    if (quality !== undefined) evaluation.quality = quality;
    if (softSkills !== undefined) evaluation.softSkills = softSkills;
    await updateDoc(docRef, {
      evaluations: arrayUnion(evaluation),
    });
  } catch (error) {
    console.error("Error evaluating submission:", error);
    throw error;
  }
};
