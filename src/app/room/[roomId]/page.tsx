"use client";

import TaskBoard from "@/components/room/TaskBoard";
import DocumentTab from "@/components/room/DocumentTab";
import RoomSettings from "@/components/room/RoomSettings";

import { useAuth } from "@/components/providers/AuthProvider";
import Navbar from "@/components/Navbar";
import { getRoom, getRoomRole, Room } from "@/lib/firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, CheckCircle2, UserCog, Files, ListTodo } from "lucide-react";
import { motion } from "framer-motion";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [role, setRole] = useState<"Leader" | "Member" | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"tasks" | "documents" | "research" | "settings">("tasks");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchRoom = async () => {
      if (!user) return;
      const data = await getRoom(params.roomId);
      if (!data || !data.members.includes(user.uid)) {
        router.push("/dashboard"); 
        return;
      }
      setRoom(data);
      const userRole = await getRoomRole(params.roomId, user.uid);
      setRole(userRole);
      setLoadingRoom(false);
    };
    
    if (user && params.roomId) {
      fetchRoom();
    }
  }, [user, params.roomId, router]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(params.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || loadingRoom) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Room Header */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60"></div>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                  {room.course}
                </span>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${
                  role === "Leader" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  <UserCog className="w-4 h-4 mr-1.5" />
                  {role}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{room.name}</h1>
              <p className="text-slate-500 flex items-center mb-4 md:mb-0">
                {room.members.length} member{room.members.length !== 1 && 's'} in this team
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col w-full md:w-auto mt-4 md:mt-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2 block">Room ID (Invite Code)</span>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                <code className="px-3 py-2 text-sm text-slate-800 font-mono select-all flex-1 text-center md:text-left">
                  {room.id}
                </code>
                <button 
                  onClick={copyRoomId}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border-l border-slate-200"
                  title="Copy ID"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
          <TabButton 
            active={activeTab === "tasks"} 
            onClick={() => setActiveTab("tasks")}
            icon={<ListTodo className="w-5 h-5 mr-2" />}
            label="Tasks & Board"
          />
          <TabButton 
            active={activeTab === "documents"} 
            onClick={() => setActiveTab("documents")}
            icon={<Files className="w-5 h-5 mr-2" />}
            label="Documents"
          />
          {role === "Leader" && (
            <TabButton 
              active={activeTab === "settings"} 
              onClick={() => setActiveTab("settings")}
              icon={<UserCog className="w-5 h-5 mr-2" />}
              label="Settings"
            />
          )}
        </div>

        {/* Tab Content Areas */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {activeTab === "tasks" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <TaskBoard roomId={room.id} role={role!} />
            </motion.div>
          )}

          {activeTab === "documents" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <DocumentTab roomId={room.id} role={role!} />
            </motion.div>
          )}
          {activeTab === "settings" && role === "Leader" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <RoomSettings roomId={room.id} />
            </motion.div>
          )}        </div>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-6 py-4 font-medium text-sm transition-colors relative whitespace-nowrap ${
        active ? "text-blue-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
      {active && (
        <motion.div 
          layoutId="activeTab" 
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" 
        />
      )}
    </button>
  );
}
