"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Task, Submission, Evaluation, submitTask, deleteTask, updateTaskStatus, updateTask } from "@/lib/firebase/tasks";
import { getRoomSettings, RoomSettings } from "@/lib/firebase/settings";
import { getRoom, Room } from "@/lib/firebase/firestore";
import { getUsersByUIDs, UserProfile } from "@/lib/firebase/users";
import { useAuth } from "@/components/providers/AuthProvider";
import { Clock, CheckCircle2, Circle, Trash2, Edit } from "lucide-react";

interface FeedbackEntry {
  id: string;
  roomId: string;
  taskId: string;
  fromUid: string;
  targetUid: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export default function TaskBoard({ roomId, role }: { roomId: string, role: "Leader" | "Member" }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<Task | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false);
  const [roomSettings, setRoomSettings] = useState<RoomSettings | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<Task | null>(null);
  const [submissionContent, setSubmissionContent] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskDetailsModalOpen, setTaskDetailsModalOpen] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    type: "assignment" as "assignment" | "project" | "quiz" | "discussion" | "presentation" | "both",
    deadline: ""
  });

  const loadFeedbacks = async () => {
    if (!roomId) return;
    try {
      const qs = new URLSearchParams({ roomId });
      const res = await fetch(`/api/feedback?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedback || []);
      }
    } catch (err) {
      console.error("Unable to fetch feedback", err);
    }
  };

  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) return;
      const r = await getRoom(roomId);
      setRoom(r);
      if (r && !r.members.includes(user?.uid || "")) {
        // ensure leader slot stays available
      }
      const members = r?.members || [];
      setSelectedMemberIds(members);

      if (members.length > 0) {
        const users = await getUsersByUIDs(members);
        setMemberProfiles(users);
      }

      // Load room settings
      const settings = await getRoomSettings(roomId);
      setRoomSettings(settings);
    };
    loadRoom();
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, "tasks"),
      where("roomId", "==", roomId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as Task);
      });
      tasksData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setTasks(tasksData);
      setLoading(false);
      loadFeedbacks();
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    loadFeedbacks();
  }, [roomId]);

  if (!roomId) return null;

  const handleStatusChange = async (taskId: string, currentStatus: Task["status"]) => {
    const nextStatus = currentStatus === "todo" ? "in-progress" : currentStatus === "in-progress" ? "done" : "todo";
    await updateTaskStatus(taskId, nextStatus);
  };

  const handleDelete = async (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(taskId);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500 animate-pulse">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl">
        <h3 className="text-lg font-medium text-slate-900 mb-1">No tasks yet</h3>
        <p className="text-slate-500 max-w-sm mx-auto">
          Upload an assignment document in the Documents tab and let AI generate tasks automatically.
        </p>
      </div>
    );
  }

  // Group tasks
  const todo = tasks.filter(t => t.status === "todo");
  const inProgress = tasks.filter(t => t.status === "in-progress");
  const done = tasks.filter(t => t.status === "done");
  const pendingTasks = tasks.filter(t => t.status !== "done");

  const submitFeedback = async () => {
    if (!feedbackTask || !user) return;
    if (!feedbackComment.trim()) {
      alert("Please write feedback before submitting.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      const payload = {
        roomId,
        taskId: feedbackTask.id,
        fromUid: user.uid,
        targetUid: feedbackTask.assigneeId,
        rating: feedbackRating,
        comment: feedbackComment.trim(),
      };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Feedback submit failed");
      setFeedbackComment("");
      setFeedbackRating(5);
      setFeedbackModalOpen(false);
      await loadFeedbacks();
      alert("Feedback submitted successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const syncTaskToCalendar = async (task: Task) => {
    if (!room || !task.deadline) {
      alert("Task deadline is required to sync to Google Calendar.");
      return;
    }
    setCalendarSyncLoading(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task.title,
          taskDescription: task.description,
          startDate: task.deadline,
          endDate: task.deadline,
          attendees: memberProfiles.map((p) => p.email).filter(Boolean),
          roomName: room.name,
        }),
      });
      if (!res.ok) throw new Error("Calendar sync failed");
      alert("Task synced to Google Calendar.");
    } catch (err) {
      console.error(err);
      alert("Failed to sync to calendar. Check your API token/settings.");
    } finally {
      setCalendarSyncLoading(false);
    }
  };

  const finalizeTaskIfPeerFeedback = (task: Task) => {
    const related = feedbacks.filter((fb) => fb.taskId === task.id && fb.targetUid === task.assigneeId);
    return related.length >= 2;
  };

  const sendReminders = async () => {
    const finalMemberIds = selectedMemberIds.length > 0 ? selectedMemberIds : Array.from(new Set(pendingTasks.map(t => t.assigneeId)));
    if (finalMemberIds.length === 0) {
      alert("No members selected for reminders.");
      return;
    }

    if (!confirm(`Send AI-generated reminder emails to ${finalMemberIds.length} team member(s)?`)) return;
    setSendingReminders(true);
    try {
      const recipients = memberProfiles.filter(profile => finalMemberIds.includes(profile.uid)).map(profile => profile.email).filter(Boolean) as string[];

      const res = await fetch("/api/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: finalMemberIds,
          memberEmails: recipients,
          roomName: room?.name || "Team Project",
          tasks: pendingTasks.map(t => ({ title: t.title, assigneeId: t.assigneeId, deadline: t.deadline }))
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      alert("Reminders generated and sent successfully!");
    } catch (err) {
      alert("Error sending reminders.");
    } finally {
      setSendingReminders(false);
    }
  };

  const handleSubmitTask = async () => {
    if (!selectedTaskForSubmission || !user || !submissionContent.trim()) return;
    setSubmittingTask(true);
    try {
      await submitTask(selectedTaskForSubmission.id, user.uid, submissionContent.trim());
      setSubmissionContent("");
      setSubmissionModalOpen(false);
      setSelectedTaskForSubmission(null);
      alert("Task submitted successfully!");
    } catch (error) {
      console.error("Submit task error:", error);
      alert("Failed to submit task.");
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleEvaluateSubmission = async (taskId: string, submissionId: string) => {
    try {
      await fetch("/api/evaluate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, submissionId, roomId }),
      });
      alert("Submission evaluated!");
      // Reload tasks
      window.location.reload();
    } catch (error) {
      console.error("Evaluate error:", error);
      alert("Failed to evaluate submission.");
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTaskForEdit(task);
    setEditForm({
      title: task.title,
      description: task.description,
      type: task.type || "assignment",
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ""
    });
    setEditTaskModalOpen(true);
  };

  const handleSaveEditTask = async () => {
    if (!selectedTaskForEdit) return;

    try {
      await updateTask(selectedTaskForEdit.id, {
        title: editForm.title,
        description: editForm.description,
        type: editForm.type,
        deadline: editForm.deadline || undefined
      });
      setEditTaskModalOpen(false);
      setSelectedTaskForEdit(null);
      alert("Task updated successfully!");
    } catch (error) {
      console.error("Edit task error:", error);
      alert("Failed to update task.");
    }
  };

  const getTaskStatusColor = (task: Task) => {
    if (!roomSettings?.enableAdvancedAssignments) return "bg-white";

    const now = new Date();
    const deadline = new Date(task.deadline);
    const submission = task.submissions?.find(s => s.userId === task.assigneeId);

    if (!submission) {
      return "bg-red-50 border-red-200"; // Not submitted
    }

    if (submission.submittedAt.toDate() > deadline) {
      return "bg-red-100 border-red-300"; // Late submission
    }

    return "bg-green-50 border-green-200"; // On time
  };

  const getSubmissionIcon = (task: Task) => {
    if (!roomSettings?.enableAdvancedAssignments) return null;

    const submission = task.submissions?.find(s => s.userId === task.assigneeId);
    if (!submission) {
      return <span className="text-red-500 text-lg">⚠️</span>; // Warning icon
    }
    return null;
  };


  return (
    <div className="space-y-4">
      {role === "Leader" && pendingTasks.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="mb-3">
            <h4 className="font-semibold text-amber-900">Task Reminders</h4>
            <p className="text-sm text-amber-700">There are {pendingTasks.length} pending tasks. Select members to send reminders to.</p>
          </div>

          {room?.members && room.members.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              {room.members.map((memberId) => (
                <label key={memberId} className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(memberId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMemberIds(prev => Array.from(new Set([...prev, memberId])));
                      } else {
                        setSelectedMemberIds(prev => prev.filter(id => id !== memberId));
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="truncate">{memberId}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-700">Selected members: {selectedMemberIds.length}</span>
            <button 
              onClick={() => setSelectedMemberIds(room?.members || [])}
              className="text-xs font-medium text-amber-700 hover:underline"
            >
              Select All
            </button>
          </div>

          <div className="mt-3 flex justify-end">
            <button 
              onClick={sendReminders}
              disabled={sendingReminders}
              className="flex items-center px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {sendingReminders ? "Generating & Sending..." : "Send AI Reminders"}
            </button>
          </div>
        </div>
      )}
      
      {feedbacks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
          <h4 className="font-semibold text-slate-900 mb-2">Feedback Rating Summary</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memberProfiles.map((member) => {
              const memberFeedback = feedbacks.filter((fb) => fb.targetUid === member.uid);
              const avgRating = memberFeedback.length > 0
                ? (memberFeedback.reduce((sum, fb) => sum + fb.rating, 0) / memberFeedback.length).toFixed(1)
                : "N/A";
              return (
                <div key={member.uid} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{member.displayName || member.email || member.uid}</p>
                  <p className="text-xs text-slate-500">Avg rating: {avgRating}</p>
                  <p className="text-xs text-slate-500">Feedback count: {memberFeedback.length}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <TaskColumn
          title="To Do"
          tasks={todo}
          icon={<Circle className="w-5 h-5 text-slate-400" />}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onOpenFeedback={(task) => { setFeedbackTask(task); setFeedbackModalOpen(true); }}
          onSyncCalendar={syncTaskToCalendar}
          calendarSyncLoading={calendarSyncLoading}
          role={role}
          currentUser={user?.uid || ""}
          feedbacks={feedbacks}
          finalizeTaskIfPeerFeedback={finalizeTaskIfPeerFeedback}
          getTaskStatusColor={getTaskStatusColor}
          getSubmissionIcon={getSubmissionIcon}
          roomSettings={roomSettings}
          onSubmitTask={(task) => { setSelectedTaskForSubmission(task); setSubmissionModalOpen(true); }}
          onViewTaskDetails={(task) => { setSelectedTaskForDetails(task); setTaskDetailsModalOpen(true); }}
          onEvaluateSubmission={handleEvaluateSubmission}
          onEditTask={handleEditTask}
        />
        <TaskColumn
          title="In Progress"
          tasks={inProgress}
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onOpenFeedback={(task) => { setFeedbackTask(task); setFeedbackModalOpen(true); }}
          onSyncCalendar={syncTaskToCalendar}
          calendarSyncLoading={calendarSyncLoading}
          role={role}
          currentUser={user?.uid || ""}
          feedbacks={feedbacks}
          finalizeTaskIfPeerFeedback={finalizeTaskIfPeerFeedback}
          getTaskStatusColor={getTaskStatusColor}
          getSubmissionIcon={getSubmissionIcon}
          roomSettings={roomSettings}
          onSubmitTask={(task) => { setSelectedTaskForSubmission(task); setSubmissionModalOpen(true); }}
          onViewTaskDetails={(task) => { setSelectedTaskForDetails(task); setTaskDetailsModalOpen(true); }}
          onEvaluateSubmission={handleEvaluateSubmission}
          onEditTask={handleEditTask}
        />
        <TaskColumn
          title="Done"
          tasks={done}
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onOpenFeedback={(task) => { setFeedbackTask(task); setFeedbackModalOpen(true); }}
          onSyncCalendar={syncTaskToCalendar}
          calendarSyncLoading={calendarSyncLoading}
          role={role}
          currentUser={user?.uid || ""}
          feedbacks={feedbacks}
          finalizeTaskIfPeerFeedback={finalizeTaskIfPeerFeedback}
          getTaskStatusColor={getTaskStatusColor}
          getSubmissionIcon={getSubmissionIcon}
          roomSettings={roomSettings}
          onSubmitTask={(task) => { setSelectedTaskForSubmission(task); setSubmissionModalOpen(true); }}
          onViewTaskDetails={(task) => { setSelectedTaskForDetails(task); setTaskDetailsModalOpen(true); }}
          onEvaluateSubmission={handleEvaluateSubmission}
          onEditTask={(task) => { /* TODO: Implement edit task */ }}
        />
      </div>

      {feedbackModalOpen && feedbackTask && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Submit Peer Feedback</h3>
              <button onClick={() => setFeedbackModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Task: <strong>{feedbackTask.title}</strong></p>
            <label className="block text-xs font-medium text-slate-700 mb-1">Rating (1-5)</label>
            <select
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-3"
            >
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="block text-xs font-medium text-slate-700 mb-1">Feedback</label>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 h-24"
              placeholder="Share specific comments and suggestions for your teammate..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setFeedbackModalOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-100">Cancel</button>
              <button
                onClick={submitFeedback}
                disabled={submittingFeedback}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submittingFeedback ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {submissionModalOpen && selectedTaskForSubmission && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Submit Task</h3>
              <button onClick={() => setSubmissionModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Task: <strong>{selectedTaskForSubmission.title}</strong></p>
            <label className="block text-xs font-medium text-slate-700 mb-1">Submission Content</label>
            <textarea
              value={submissionContent}
              onChange={(e) => setSubmissionContent(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 h-32"
              placeholder="Enter your submission here..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSubmissionModalOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-100">Cancel</button>
              <button
                onClick={handleSubmitTask}
                disabled={submittingTask || !submissionContent.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {submittingTask ? "Submitting..." : "Submit Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskDetailsModalOpen && selectedTaskForDetails && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Task Details</h3>
              <button onClick={() => setTaskDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-slate-900">{selectedTaskForDetails.title}</h4>
                <p className="text-sm text-slate-600 mt-1">{selectedTaskForDetails.description}</p>
                {selectedTaskForDetails.type && (
                  <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {selectedTaskForDetails.type}
                  </span>
                )}
              </div>

              {selectedTaskForDetails.deadline && (
                <div className="text-sm">
                  <span className="font-medium">Deadline:</span> {new Date(selectedTaskForDetails.deadline).toLocaleString()}
                </div>
              )}

              {selectedTaskForDetails.submissions && selectedTaskForDetails.submissions.length > 0 && (
                <div>
                  <h5 className="font-medium text-slate-900 mb-2">Submissions</h5>
                  <div className="space-y-2">
                    {selectedTaskForDetails.submissions.map((submission) => {
                      const evaluation = selectedTaskForDetails.evaluations?.find(e => e.submissionId === submission.id);
                      return (
                        <div key={submission.id} className="bg-slate-50 p-3 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">Submitted: {submission.submittedAt.toDate().toLocaleString()}</span>
                            {role === "Leader" && !evaluation && (
                              <button
                                onClick={() => handleEvaluateSubmission(selectedTaskForDetails.id, submission.id)}
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                              >
                                Evaluate
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-slate-700">{submission.content}</p>
                          {evaluation && (
                            <div className="mt-2 text-sm">
                              <span className={`font-bold ${evaluation.score < 5 ? 'text-red-600' : 'text-green-600'}`}>
                                Score: {evaluation.score}/10
                              </span>
                              <span className="text-slate-500 ml-2">Relevance: {evaluation.relevance}/10</span>
                              <p className="text-slate-600 mt-1">{evaluation.comment}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editTaskModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Edit Task</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2 border rounded h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "assignment" | "project" | "quiz" | "discussion" | "presentation" | "both" })}
                  className="w-full p-2 border rounded"
                >
                  <option value="assignment">Assignment</option>
                  <option value="project">Project</option>
                  <option value="quiz">Quiz</option>
                  <option value="discussion">Discussion</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  value={editForm.deadline}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditTaskModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditTask}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskColumn({ 
  title, 
  tasks, 
  icon, 
  onStatusChange, 
  onDelete, 
  onOpenFeedback, 
  onSyncCalendar, 
  calendarSyncLoading,
  role, 
  currentUser,
  feedbacks,
  finalizeTaskIfPeerFeedback,
  getTaskStatusColor,
  getSubmissionIcon,
  roomSettings,
  onSubmitTask,
  onViewTaskDetails,
  onEvaluateSubmission,
  onEditTask
}: { 
  title: string, 
  tasks: Task[], 
  icon: React.ReactNode, 
  onStatusChange: (id: string, s: Task["status"]) => void,
  onDelete: (id: string) => void,
  onOpenFeedback: (task: Task) => void,
  onSyncCalendar: (task: Task) => void,
  calendarSyncLoading: boolean,
  role: "Leader" | "Member",
  currentUser: string,
  feedbacks: FeedbackEntry[],
  finalizeTaskIfPeerFeedback: (task: Task) => boolean,
  getTaskStatusColor: (task: Task) => string,
  getSubmissionIcon: (task: Task) => React.ReactNode | null,
  roomSettings: RoomSettings | null,
  onSubmitTask: (task: Task) => void,
  onViewTaskDetails: (task: Task) => void,
  onEvaluateSubmission: (taskId: string, submissionId: string) => void,
  onEditTask: (task: Task) => void
}) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-semibold text-slate-800 flex items-center">
          {icon} <span className="ml-2">{title}</span>
        </h3>
        <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      
      <div className="flex-1 space-y-3">
        {tasks.map(task => {
          const isAssignee = task.assigneeId === currentUser;
          const canEdit = role === "Leader" || isAssignee;
          const submission = task.submissions?.find(s => s.userId === task.assigneeId);
          const evaluation = task.evaluations?.find(e => e.submissionId === submission?.id);

          return (
            <div key={task.id} className={`p-4 rounded-xl shadow-sm border group ${getTaskStatusColor(task)}`}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-900 leading-tight flex items-center">
                  {task.title}
                  {getSubmissionIcon(task)}
                  {task.type && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{task.type}</span>}
                </h4>
                {role === "Leader" && (
                  <div className="flex space-x-1">
                    <button onClick={() => onEditTask(task)} className="text-slate-300 hover:text-blue-500 transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(task.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-4 italic line-clamp-3">{task.description}</p>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm mr-2 ${isAssignee ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    {task.assigneeName?.charAt(0) || "?"}
                  </div>
                  <span className="text-xs text-slate-600 truncate max-w-[80px]">
                    {task.assigneeName || "Unassigned"}
                  </span>
                </div>
                
                {canEdit ? (
                  <button 
                    onClick={() => onStatusChange(task.id, task.status)}
                    className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    Move
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">View Only</span>
                )}
              </div>
              {task.deadline && (
                <div className="mt-3 pt-3 border-t border-slate-50 text-[10px] uppercase font-bold text-slate-400 flex justify-between">
                  <span>Deadline:</span>
                  <span className={new Date(task.deadline) < new Date() ? 'text-red-500' : 'text-slate-500'}>
                    {new Date(task.deadline).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                {roomSettings?.enableAdvancedAssignments && isAssignee && !submission && (
                  <button
                    onClick={() => onSubmitTask(task)}
                    className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100"
                  >
                    Submit
                  </button>
                )}
                <button
                  onClick={() => onViewTaskDetails(task)}
                  className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  Details
                </button>
                <button
                  onClick={() => onOpenFeedback(task)}
                  className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  Feedback
                </button>
                <button
                  onClick={() => onSyncCalendar(task)}
                  disabled={calendarSyncLoading}
                  className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  {calendarSyncLoading ? "Syncing..." : "Calendar"}
                </button>
              </div>

              {evaluation && (
                <div className="mt-2 text-xs">
                  <span className={`font-bold ${evaluation.score < 5 ? 'text-red-600' : 'text-green-600'}`}>
                    Score: {evaluation.score}/10
                  </span>
                  <span className="text-slate-500 ml-2">Relevance: {evaluation.relevance}/10</span>
                </div>
              )}

              {task.status === "done" && (
                <div className="mt-2 text-xs text-slate-500">
                  {finalizeTaskIfPeerFeedback(task)
                    ? "Peer feedback complete (>=2). Task can be finalized."
                    : `Peer feedback needed: ${feedbacks.filter((fb) => fb.taskId === task.id).length}/2`}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}
