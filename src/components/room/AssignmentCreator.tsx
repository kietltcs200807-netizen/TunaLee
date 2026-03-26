"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getUsersByUIDs, UserProfile } from "@/lib/firebase/users";
import { getRoom, Room } from "@/lib/firebase/firestore";
import { Send, Trash2, Edit, Check, X, MessageSquare } from "lucide-react";

interface AssignmentCreatorProps {
  roomId: string;
  onCreateAssignments: (assignments: any[]) => void;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  type: "presentation" | "assignment" | "both";
  deadline?: string;
  assignedMembers: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AssignmentCreator({ roomId, onCreateAssignments }: AssignmentCreatorProps) {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I'm here to help you create assignments for your team. Tell me about what you need, and I'll generate appropriate tasks.",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    type: "assignment" as "presentation" | "assignment" | "both",
    deadline: ""
  });

  useEffect(() => {
    const loadRoomData = async () => {
      if (!roomId) return;
      const roomData = await getRoom(roomId);
      setRoom(roomData);
      if (roomData?.members) {
        const memberProfiles = await getUsersByUIDs(roomData.members);
        // Sort members alphabetically by display name
        memberProfiles.sort((a, b) => {
          const nameA = a.displayName || a.email || a.uid;
          const nameB = b.displayName || b.email || b.uid;
          return nameA.localeCompare(nameB);
        });
        setMembers(memberProfiles);
      }
    };
    loadRoomData();
  }, [roomId]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          roomId,
          history: chatMessages.slice(-5) // Last 5 messages for context
        })
      });

      const data = await response.json();
      if (response.ok) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, assistantMessage]);

        // If assignments were generated, add them
        if (data.assignments) {
          setAssignments(data.assignments);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleMemberAssignment = (assignmentId: string, memberId: string) => {
    setAssignments(prev => prev.map(assignment =>
      assignment.id === assignmentId
        ? {
            ...assignment,
            assignedMembers: assignment.assignedMembers.includes(memberId)
              ? assignment.assignedMembers.filter(id => id !== memberId)
              : [...assignment.assignedMembers, memberId]
          }
        : assignment
    ));
  };

  const deleteAllAssignments = () => {
    if (confirm("Are you sure you want to delete all assignments?")) {
      setAssignments([]);
    }
  };

  const startEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment.id);
    setEditForm({
      title: assignment.title,
      description: assignment.description,
      type: assignment.type,
      deadline: assignment.deadline || ""
    });
  };

  const saveEditAssignment = () => {
    setAssignments(prev => prev.map(assignment =>
      assignment.id === editingAssignment
        ? {
            ...assignment,
            title: editForm.title,
            description: editForm.description,
            type: editForm.type,
            deadline: editForm.deadline || undefined
          }
        : assignment
    ));
    setEditingAssignment(null);
  };

  const completeAssignments = () => {
    // Convert assignments to tasks and pass to parent
    const tasks = assignments.flatMap(assignment =>
      assignment.assignedMembers.map(memberId => ({
        title: assignment.title,
        description: assignment.description,
        assigneeId: memberId,
        assigneeName: members.find(m => m.uid === memberId)?.displayName || "Unknown",
        deadline: assignment.deadline,
        type: assignment.type,
        status: "todo" as const
      }))
    );
    onCreateAssignments(tasks);
    setAssignments([]);
  };

  if (!room) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Chat Interface */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          AI Assignment Assistant
        </h3>

        {/* Chat Messages */}
        <div className="h-64 overflow-y-auto border border-slate-200 rounded-lg p-4 mb-4 space-y-3">
          {chatMessages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}>
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-800 px-4 py-2 rounded-lg">
                <p className="text-sm">AI is thinking...</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Describe the assignments you need..."
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isGenerating}
          />
          <button
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isGenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Assignment Table */}
      {assignments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Assignment Assignments</h3>
            <button
              onClick={deleteAllAssignments}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              <Trash2 className="w-4 h-4 mr-1 inline" />
              Delete All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-4 font-semibold text-slate-900">Assignment</th>
                  <th className="text-left py-2 px-4 font-semibold text-slate-900">Type</th>
                  <th className="text-left py-2 px-4 font-semibold text-slate-900">Deadline</th>
                  {members.map(member => (
                    <th key={member.uid} className="text-center py-2 px-2 font-semibold text-slate-900 min-w-[100px]">
                      {member.displayName || member.email || member.uid}
                    </th>
                  ))}
                  <th className="text-center py-2 px-4 font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(assignment => (
                  <tr key={assignment.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      {editingAssignment === assignment.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                            placeholder="Title"
                          />
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                            placeholder="Description"
                            rows={2}
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-slate-900">{assignment.title}</div>
                          <div className="text-sm text-slate-600 mt-1">{assignment.description}</div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingAssignment === assignment.id ? (
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as any }))}
                          className="border border-slate-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="assignment">Assignment</option>
                          <option value="presentation">Presentation</option>
                          <option value="both">Both</option>
                        </select>
                      ) : (
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {assignment.type}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingAssignment === assignment.id ? (
                        <input
                          type="datetime-local"
                          value={editForm.deadline}
                          onChange={(e) => setEditForm(prev => ({ ...prev, deadline: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-sm text-slate-600">
                          {assignment.deadline ? new Date(assignment.deadline).toLocaleString() : 'No deadline'}
                        </span>
                      )}
                    </td>
                    {members.map(member => (
                      <td key={member.uid} className="text-center py-3 px-2">
                        <button
                          onClick={() => toggleMemberAssignment(assignment.id, member.uid)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            assignment.assignedMembers.includes(member.uid)
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                          }`}
                        >
                          {assignment.assignedMembers.includes(member.uid) ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                      </td>
                    ))}
                    <td className="text-center py-3 px-4">
                      {editingAssignment === assignment.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={saveEditAssignment}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingAssignment(null)}
                            className="px-2 py-1 bg-slate-600 text-white rounded text-xs hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditAssignment(assignment)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          <Edit className="w-3 h-3 inline mr-1" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={completeAssignments}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Complete & Post Assignments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}