"use client";

import { useState, useRef, useEffect } from "react";
import { BrainCircuit, Send, Loader2, Bot, User } from "lucide-react";
import { motion } from "framer-motion";
import { fetchJson } from "@/lib/fetchJson";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ResearchTab() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I am your AI Research Assistant. Tell me about the topic you're working on, and I'll find real-world information and summarize how to apply it to your task." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input.trim();
    const newMessages: Message[] = [...messages, { role: "user", content: userQuery }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const data = await fetchJson("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, history: messages.slice(1) }),
      });

      setMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch (error: any) {
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Error contacting research core: " + error.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between z-10">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 text-purple-700 rounded-xl mr-3">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Smart Researcher</h3>
            <p className="text-xs text-slate-500">Ask for explanations, summaries, or how to tackle a sub-task.</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                msg.role === "user" ? "bg-slate-900 text-white ml-3" : "bg-purple-100 text-purple-600 mr-3"
              }`}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-4 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-slate-900 text-white rounded-tr-none" 
                  : "bg-slate-100 text-slate-800 rounded-tl-none prose prose-sm prose-slate"
              }`}>
                {/* For production, we'd use react-markdown here. Keeping simple for now */}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex flex-row">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-100 text-purple-600 mr-3 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-100 rounded-tl-none flex items-center space-x-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your research question here..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-3 pl-5 pr-14 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            disabled={loading}
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
