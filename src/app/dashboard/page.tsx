"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Navbar from "@/components/Navbar";
import { getUserRooms, Room, createRoom, joinRoom } from "@/lib/firebase/firestore";
import { Plus, Users, ArrowRight, Loader2, Link2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  
  // Form states
  const [roomName, setRoomName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const loadRooms = async () => {
    if (!user) return;
    setLoadingRooms(true);
    const userRooms = await getUserRooms(user.uid);
    setRooms(userRooms);
    setLoadingRooms(false);
  };

  useEffect(() => {
    if (user) {
      loadRooms();
    }
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!roomName.trim() || !courseName.trim()) return;

    setIsSubmitting(true);
    setErrorText("");
    try {
      const roomId = await createRoom(roomName, courseName, user.uid);
      setShowCreate(false);
      setRoomName("");
      setCourseName("");
      startTransition(() => {
        router.push(`/room/${roomId}`);
      });
    } catch (error) {
      setErrorText("Failed to create room. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!joinId.trim()) return;

    setIsSubmitting(true);
    setErrorText("");
    try {
      await joinRoom(joinId.trim(), user.uid);
      setShowJoin(false);
      setJoinId("");
      startTransition(() => {
        router.push(`/room/${joinId.trim()}`);
      });
    } catch (error) {
      setErrorText("Invalid room ID or you are already a member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your Teams</h1>
            <p className="text-slate-500 mt-1">Manage your assignments and collaborate with your peers.</p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-4">
            <button 
              onClick={() => setShowJoin(true)}
              className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Link2 className="w-5 h-5 mr-2 text-slate-400" />
              Join Room
            </button>
            <button 
              onClick={() => setShowCreate(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Room
            </button>
          </div>
        </div>

        {loadingRooms ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-slate-900 mb-2">No Active Teams</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">
              You aren't part of any team rooms yet. Create a new room to be the tech-lead of your assignment, or join an existing one using an ID.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setShowCreate(true)}
                className="text-blue-600 font-medium hover:underline"
              >
                Create Room
              </button>
              <span className="text-slate-300">|</span>
              <button 
                onClick={() => setShowJoin(true)}
                className="text-slate-600 font-medium hover:underline"
              >
                Join Room
              </button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={room.id}
              >
                <div 
                  onClick={() => router.push(`/room/${room.id}`)}
                  className="bg-white group cursor-pointer border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col h-full"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {room.course}
                      </span>
                      {room.leaderId === user.uid && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                          Leader
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {room.name}
                    </h3>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {room.members.length} members
                    </div>
                    <div className="flex items-center text-blue-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                      Enter <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Create New Team</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              {errorText && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{errorText}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Name</label>
                <input 
                  type="text" 
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Final Web Project Team"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course / Subject</label>
                <input 
                  type="text" 
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. CS50"
                  required
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || isPending}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {(isSubmitting || isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Team"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* JOIN MODAL */}
      {showJoin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Join Team Room</h2>
              <button onClick={() => setShowJoin(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleJoinRoom} className="p-6 space-y-4">
              {errorText && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{errorText}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room ID</label>
                <input 
                  type="text" 
                  value={joinId}
                  onChange={e => setJoinId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                  placeholder="Paste Room ID here..."
                  required
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowJoin(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || isPending}
                  className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center"
                >
                  {(isSubmitting || isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join Team"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
