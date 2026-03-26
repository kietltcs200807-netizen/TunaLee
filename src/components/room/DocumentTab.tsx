"use client";

import { useState, useEffect } from "react";
import { uploadDocument, getRoomDocuments, ProjectDocument } from "@/lib/firebase/storage";
import { useAuth } from "@/components/providers/AuthProvider";
import { FileText, Upload, Loader2, BrainCircuit } from "lucide-react";
import AssignmentCreator from "./AssignmentCreator";

export default function DocumentTab({ roomId, role }: { roomId: string, role: "Leader" | "Member" }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [textProcessing, setTextProcessing] = useState(false);
  const [assignmentText, setAssignmentText] = useState("");
  const [error, setError] = useState("");
  const [taskType, setTaskType] = useState<"presentation" | "assignment" | "both">("assignment");
  const [taskDeadline, setTaskDeadline] = useState("");

  const loadDocs = async () => {
    setLoading(true);
    const docs = await getRoomDocuments(roomId);
    setDocuments(docs);
    setLoading(false);
  };

  useEffect(() => {
    loadDocs();
  }, [roomId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Accept text or pdf for AI analysis
    if (!file.type.includes("pdf") && !file.type.includes("text")) {
      setError("Please upload a PDF or Text file for AI analysis.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      await uploadDocument(file, roomId, user.uid);
      await loadDocs(); // reload list
    } catch (err) {
      setError("Failed to upload document.");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleGenerateTasks = async (docUrl: string) => {
    if (!confirm("This will use AI to read the document and generate tasks. Continue?")) return;
    setGenerating(true);
    setError("");
    
    try {
      const { getRoom } = await import("@/lib/firebase/firestore");
      const room = await getRoom(roomId);
      if (!room) throw new Error("Room not found");

      const res = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          roomId, 
          documentUrl: docUrl, 
          members: room.members,
          type: taskType,
          deadline: taskDeadline || undefined
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate tasks");
      
      const { createTask } = await import("@/lib/firebase/tasks");
      for (const t of data.tasks) {
        await createTask({
          roomId,
          title: t.title,
          description: t.description,
          assigneeId: t.assigneeId,
          assigneeName: "Member " + t.assigneeId.substring(0, 4),
          deadline: t.deadline,
          status: "todo",
          type: t.type || taskType
        });
      }
      
      alert("Tasks generated successfully! Check the Task Board.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during AI processing.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateTasksFromText = async () => {
    if (!assignmentText.trim()) {
      setError("Please paste assignment text before generating tasks.");
      return;
    }

    if (!confirm("This will use AI to analyze the pasted assignment text and generate tasks. Continue?")) return;

    setTextProcessing(true);
    setError("");

    try {
      const { getRoom } = await import("@/lib/firebase/firestore");
      const room = await getRoom(roomId);
      if (!room) throw new Error("Room not found");

      const res = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          roomId, 
          rawText: assignmentText, 
          members: room.members,
          type: taskType,
          deadline: taskDeadline || undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate tasks");

      const { createTask } = await import("@/lib/firebase/tasks");
      for (const t of data.tasks) {
        await createTask({
          roomId,
          title: t.title,
          description: t.description,
          assigneeId: t.assigneeId,
          assigneeName: "Member " + t.assigneeId.substring(0, 4),
          deadline: t.deadline,
          status: "todo",
          type: t.type || taskType
        });
      }

      alert("Tasks generated successfully from text! Check the Task Board.");
      setAssignmentText("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during AI text processing.");
    } finally {
      setTextProcessing(false);
    }
  };

  if (loading) return <div className="py-10 text-center animate-pulse text-slate-500">Loading documents...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-8">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Assignment Documents</h3>
          <p className="text-slate-600 text-sm mt-1 max-w-md">
            {role === "Leader" ? "Upload assignment instructions so the AI can build a project plan and split tasks." : "View the uploaded assignments for this project."}
          </p>
        </div>
        
        {role === "Leader" && (
          <div className="mt-4 md:mt-0 relative">
            <input 
              type="file" 
              accept=".pdf,.txt,text/plain,application/pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              onChange={handleFileUpload}
              disabled={uploading || generating}
            />
            <button 
              disabled={uploading || generating}
              className="flex items-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
              {uploading ? "Uploading..." : "Upload PDF / TXT"}
            </button>
          </div>
        )}
      </div>

      {role === "Leader" && (
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-2">Task Generation Options</h4>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Task Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as "presentation" | "assignment" | "both")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="assignment">Assignment</option>
                <option value="presentation">Presentation</option>
                <option value="both">Both (Assignment + Presentation)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deadline (Optional)</label>
              <input
                type="datetime-local"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <p className="text-slate-600 text-sm mb-3">These options will be applied to all generated tasks.</p>
        </div>
      )}

      {role === "Leader" && (
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-2">Leader AI Assignment Chat</h4>
          <p className="text-slate-600 text-sm mb-3">Paste assignment instructions here (or use uploaded files). The AI will parse and create tasks for your team.</p>
          <textarea
            value={assignmentText}
            onChange={(e) => setAssignmentText(e.target.value)}
            placeholder="Paste assignment text..."
            className="w-full min-h-[140px] p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleGenerateTasksFromText}
            disabled={textProcessing || !assignmentText.trim()}
            className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {textProcessing ? "Processing text..." : "Generate Tasks from Text"}
          </button>
        </div>
      )}

      {role === "Leader" && (
        <AssignmentCreator
          roomId={roomId}
          onCreateAssignments={async (tasks) => {
            // Create tasks in database
            const { createTask } = await import("@/lib/firebase/tasks");
            for (const task of tasks) {
              await createTask({
                roomId,
                title: task.title,
                description: task.description,
                assigneeId: task.assigneeId,
                assigneeName: task.assigneeName,
                deadline: task.deadline,
                status: task.status,
                type: task.type
              });
            }
            alert("Assignments created and posted to team!");
          }}
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => (
          <div key={doc.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col">
            <div className="flex items-start mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mr-4">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 line-clamp-1" title={doc.name}>{doc.name}</h4>
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-sm text-blue-600 hover:underline inline-block mt-1"
                >
                  View File
                </a>
              </div>
            </div>
            
            {role === "Leader" && (
              <button 
                onClick={() => handleGenerateTasks(doc.url)}
                disabled={generating}
                className="mt-auto w-full flex items-center justify-center py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                Generate Tasks with AI
              </button>
            )}
          </div>
        ))}

        {documents.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900">No Documents Found</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-1">
              Upload PDF or Text files containing assignment instructions to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
