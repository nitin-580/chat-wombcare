'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Plus,
  LogOut,
  ChevronDown,
  BookOpen,
  Sparkles,
  MessageSquare,
  Trash2,
  X,
  ArrowUp,
  Heart,
  Droplet,
  Moon,
  Activity,
  User,
  Lock,
  ExternalLink,
  ShieldAlert,
  Check,
  Globe,
  ArrowLeft
} from 'lucide-react';

interface Message {
  id?: string;
  role: 'user' | 'model';
  sender: string;
  content: string;
  createdAt?: string;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  age?: number;
  water_intake?: number;
  target_water?: number;
  sleep?: number;
  cycle_length?: number;
  next_period_date?: string;
  symptoms?: any;
  mood?: string;
  weight?: number;
  wellness_goal?: string;
  active_plan?: string;
  is_premium?: boolean;
}

export default function Home() {
  // Authentication States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoginLoading, setIsLoginLoading] = useState<boolean>(false);
  
  // User Data States
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isPlanChecking, setIsPlanChecking] = useState<boolean>(true);
  
  // Chat States
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check login status on mount (Sign in directly if tokens are available)
  useEffect(() => {
    const token = localStorage.getItem('userToken');
    const storedUserData = localStorage.getItem('userData');
    
    if (token && storedUserData) {
      try {
        const parsedUser = JSON.parse(storedUserData);
        fetchUserProfile(parsedUser.id);
      } catch (err) {
        console.error('Error parsing stored user data:', err);
        setIsPlanChecking(false);
      }
    } else {
      setIsPlanChecking(false);
    }
  }, []);

  const fetchUserProfile = async (userId: string) => {
    setIsPlanChecking(true);
    try {
      const res = await fetch(`/api/profile?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setUser(data.profile);
          setIsLoggedIn(true);
          fetchSessions(userId);
          createNewSession();
        } else {
          // Fallback to local storage values if profile details are not in DB
          const storedUserData = localStorage.getItem('userData');
          if (storedUserData) {
            setUser(JSON.parse(storedUserData));
            setIsLoggedIn(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setIsPlanChecking(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoginLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://womb-care-backend-76858014616.europe-west1.run.app';
      
      const res = await fetch(`${backendUrl}/api/doctors/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.message || 'Invalid email or password');
        setIsLoginLoading(false);
        return;
      }

      // Save user session
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.doctor));
      
      // Fetch fresh profile with active plan verification from Supabase
      await fetchUserProfile(data.doctor.id);
    } catch (err) {
      setLoginError('Connection to Wombcare backend failed. Please try again.');
      console.error('Login Error:', err);
      setIsLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUser(null);
    setIsLoggedIn(false);
    setSessions([]);
    setMessages([]);
    setCurrentSessionId('');
  };

  const fetchSessions = async (userId: string) => {
    try {
      const res = await fetch(`/api/sessions?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSession = async (id: string) => {
    setCurrentSessionId(id);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = () => {
    const newId = crypto.randomUUID();
    setCurrentSessionId(newId);
    setMessages([]);
    setInput('');
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      const res = await fetch(`/api/sessions?sessionId=${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (user) fetchSessions(user.id);
        if (currentSessionId === id) {
          createNewSession();
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const finalMsg = textToSend || input;
    if (!finalMsg.trim() || isLoading || !user) return;

    const userMessage: Message = {
      role: 'user',
      sender: user.name,
      content: finalMsg
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMsg,
          sessionId: currentSessionId,
          history: messages,
          userId: user.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply: Message = {
          role: 'model',
          sender: 'Divya',
          content: data.reply
        };
        setMessages(prev => [...prev, reply]);
        fetchSessions(user.id);
      } else {
        const errData = await res.json();
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            sender: 'Divya',
            content: `Error: ${errData.error || 'Failed to generate response. Please check your connection.'}`
          }
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          sender: 'Divya',
          content: `Error: Failed to send message. ${err.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleImprovePrompt = () => {
    if (!input.trim()) {
      setInput('Could you explain what causes PCOD/PCOS hormonal flareups and what lifestyle tweaks help: ');
    } else {
      setInput(prev => `Improve this query to focus on cycle synchronization, nutrition, and root lifestyle advice: "${prev}"`);
    }
  };

  const promptLibrary = [
    "What are the best dietary guidelines to manage insulin resistance in PCOS?",
    "Can you suggest a 10-minute yoga routine for menstrual cramps?",
    "How does seed cycling help balance progesterone and estrogen?",
    "Recommend a high-protein, low-GI vegetarian lunch options for PCOD.",
    "Explain what cycle-syncing exercise routines are."
  ];

  // Helper parser for bold (**text**), italic (*text*), and underline (__text__) markdown tags
  const renderTextWithFormatting = (text: string) => {
    const inlineRegex = /(\*\*.*?\*\*|\*.*?\*|__.*?__)/g;
    const splitText = text.split(inlineRegex);
    
    return splitText.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-slate-800">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('__') && part.endsWith('__')) {
        return <u key={index} className="underline text-slate-900">{part.slice(2, -2)}</u>;
      }
      return part;
    });
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    let inList = false;
    const listItems: React.ReactNode[] = [];
    const resultElements: React.ReactNode[] = [];
    
    lines.forEach((line, index) => {
      const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
      
      if (isBullet) {
        const cleanLine = line.trim().substring(2);
        listItems.push(
          <li key={`li-${index}`} className="ml-5 list-disc mb-1.5 text-slate-800">
            {renderTextWithFormatting(cleanLine)}
          </li>
        );
        inList = true;
      } else {
        if (inList) {
          resultElements.push(
            <ul key={`ul-${index}`} className="my-2 space-y-1">
              {[...listItems]}
            </ul>
          );
          listItems.length = 0;
          inList = false;
        }
        
        if (line.trim() === '') {
          resultElements.push(<div key={`br-${index}`} className="h-2" />);
        } else {
          resultElements.push(
            <p key={`p-${index}`} className="mb-2 leading-relaxed">
              {renderTextWithFormatting(line)}
            </p>
          );
        }
      }
    });
    
    if (inList && listItems.length > 0) {
      resultElements.push(
        <ul key={`ul-end`} className="my-2 space-y-1">
          {[...listItems]}
        </ul>
      );
    }
    
    return resultElements;
  };

  // 1. Loading Check State
  if (isPlanChecking) {
    return (
      <div className="min-h-screen w-screen bg-[#F8F4FF] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Verifying Care Program Status...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Login Screen
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen w-screen bg-[#F8F4FF] relative flex items-center justify-center p-6 overflow-hidden selection:bg-[#FFE5EF] selection:text-[#FF4D8D] font-sans">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#FFE5EF]/50 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#EEE9FF]/50 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-[30px] border border-white shadow-xl p-8 relative z-10 transition-all duration-300 animate-slide-in">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo.png"
                alt="WombCare Logo"
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-[42px] font-black text-[#FF4D8D] tracking-tight leading-none">
              WombCare
            </h1>
            <p className="text-[10px] text-[#7C5CFF] font-extrabold tracking-widest uppercase mt-1">
              Personal Wellness Console
            </p>
            <p className="text-[#666] text-sm mt-3">
              Sign in to sync your health trackers and access clinical guidance with Divya
            </p>
          </div>

          {loginError && (
            <div className="mb-6 p-4 bg-[#FFE5EF] border border-[#FFE4E1] text-[#FF4D8D] text-xs font-semibold rounded-2xl">
              <span>⚠️ {loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-[#555] text-xs font-bold mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3.5 bg-[#FAFAFA] border border-[#EEE] rounded-[18px] text-[#111] focus:outline-none focus:ring-2 focus:ring-[#7C5CFF] focus:bg-white text-sm"
                placeholder="you@wombcare.live"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[#555] text-xs font-bold mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3.5 bg-[#FAFAFA] border border-[#EEE] rounded-[18px] text-[#111] focus:outline-none focus:ring-2 focus:ring-[#7C5CFF] focus:bg-white text-sm"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoginLoading}
              className="w-full h-[58px] bg-[#111] hover:bg-slate-950 text-white font-bold rounded-[24px] shadow-lg transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoginLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Verify & Access Divya"
              )}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // 3. Restriction Validation (Validate if user is premium/active program subscriber)
  const isPremiumUser = !!(user?.active_plan || user?.is_premium);

  if (!isPremiumUser) {
    const plans = [
      {
        name: "Complete PMOS Care",
        price: "₹2999",
        duration: "3 Months",
        description: "90 Days PMOS care program",
        tag: "Recommended",
        features: [
          "Period Tracker Logs",
          "Daily Hydration Trackers",
          "Insulin resistance guidelines",
          "1-on-1 care consultation",
        ],
        highlighted: true
      },
      {
        name: "Conceive Care",
        price: "₹4999",
        duration: "3 Months",
        description: "Designed for preparing your conception journey.",
        tag: "Fertility support",
        features: [
          "Ovulation tracking logs",
          "Cycle wellness guides",
          "High protein nutrition tips",
          "Dedicated medical coach",
        ],
        highlighted: false
      },
      {
        name: "NRI Special",
        price: "$32",
        duration: "3 Months",
        description: "Premium doctor-guided care program tailored for international users.",
        tag: "International Plan",
        features: [
          "Everything in PMOS Care",
          "Global Call consults",
          "Custom timezone coaching",
          "Dedicated priority help",
        ],
        highlighted: false
      }
    ];

    return (
      <main className="min-h-screen w-screen bg-[#FDF8F8] relative flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-4xl bg-white border border-[#F5E2E2] rounded-[32px] shadow-xl p-8 flex flex-col items-center relative overflow-hidden">
          
          {/* Header */}
          <div className="text-center max-w-xl mb-8 flex flex-col items-center">
            <div className="mb-4 relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center bg-rose-50 border border-rose-100">
              <Image src="/logo.png" alt="WombCare Logo" width={48} height={48} className="object-contain" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 leading-none">Hormonal Health Plan Required</h2>
            <p className="text-rose-600 font-bold text-xs uppercase tracking-wider mt-2.5">AI Access Limited</p>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
              We noticed you don't have an active care program. Divya requires an active WombCare plan to sync with trackers and assist you. Choose one of our doctor-backed programs below:
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
            {plans.map((p, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${
                  p.highlighted
                    ? 'bg-rose-50/50 border-rose-200 shadow-md ring-2 ring-rose-500/20'
                    : 'bg-[#FAFAFA] border-slate-100'
                }`}
              >
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    p.highlighted ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {p.tag}
                  </span>
                  <h3 className="font-extrabold text-slate-800 text-lg mt-3">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.description}</p>
                  
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{p.price}</span>
                    <span className="text-xs text-slate-400">/ {p.duration}</span>
                  </div>

                  <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                    {p.features.map((f, fIdx) => (
                      <li key={fIdx} className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Check size={12} className="text-rose-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={`https://wombcare.in/pricing?plan=${encodeURIComponent(p.name)}`}
                  target="_blank"
                  className={`mt-6 w-full py-2.5 rounded-xl text-center text-xs font-bold transition ${
                    p.highlighted
                      ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-md'
                      : 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  Purchase Plan
                </a>
              </div>
            ))}
          </div>

          {/* Activation Disclaimer */}
          <div className="bg-[#FFF4F4] border border-[#FBE6E6] rounded-2xl p-4 text-center max-w-xl text-xs text-slate-600 mb-6 font-semibold flex items-center justify-center gap-2">
            <ShieldAlert size={16} className="text-rose-600 shrink-0" />
            <span>Already bought a plan? Please contact the WombCare Support Admin (hello@wombcare.in) with your receipt to activate your account.</span>
          </div>

          {/* Actions Bar */}
          <div className="flex gap-4 items-center w-full justify-center">
            <a
              href="https://wombcare.in"
              className="flex items-center gap-1.5 px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs transition"
            >
              <ArrowLeft size={14} />
              <span>Back to Wombcare.in</span>
            </a>
            
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition"
            >
              Sign Out
            </button>
          </div>

        </div>
      </main>
    );
  }

  return (
    /* MAIN ASSISTANT INTERFACE - FEMININE Wombcare Theme (No Gradient, Softer colors) */
    <div className="flex h-screen w-screen bg-[#FCF6F6] text-[#2C2C35] overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-[300px] bg-[#F7EEEE] border-r border-[#EAD4D4] flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Sidebar Header */}
          <div className="p-5 flex items-center justify-between border-b border-[#EAD4D4]/60">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 relative rounded-xl overflow-hidden flex items-center justify-center bg-white border border-[#EAD4D4]/40">
                <Image
                  src="/logo.png"
                  alt="Wombcare Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <span className="font-bold text-base text-slate-800 tracking-tight">WombCare Divya</span>
            </div>
            <button
              onClick={createNewSession}
              className="p-2 hover:bg-white/60 text-rose-600 rounded-lg transition"
              title="New Chat"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Connected User Summary Tracker Card (Water, sleep details) */}
          {user && (
            <div className="p-4 mx-3 my-4 bg-white/70 border border-[#EAD4D4]/40 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Connected Tracker Metrics</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-1.5 p-2 bg-[#FFF4F4] rounded-xl border border-[#FBE6E6]">
                  <Droplet size={14} className="text-blue-500 fill-blue-100" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold leading-none">Water</span>
                    <span>{user.water_intake || 0} Glass</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-[#FFF4F4] rounded-xl border border-[#FBE6E6]">
                  <Moon size={14} className="text-amber-500 fill-amber-100" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold leading-none">Sleep</span>
                    <span>{user.sleep || 0} Hours</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conversations History */}
          <div className="flex-1 overflow-y-auto px-3 pt-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">My Chat History</h3>
            
            {sessions.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-8">
                No past consultations.
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                      currentSessionId === s.id
                        ? 'bg-white text-slate-900 shadow-sm border border-[#EAD4D4]'
                        : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare size={14} className={currentSessionId === s.id ? 'text-rose-500' : 'text-slate-400'} />
                      <span className="text-xs font-semibold truncate">{s.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#EAD4D4] bg-[#F0E2E2]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 border border-white/60 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {user?.name ? user.name.split(' ').map(n=>n[0]).join('') : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 transition p-1"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-white">
        
        {/* Top Header */}
        <header className="h-[60px] border-b border-[#EAD4D4]/60 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full flex items-center gap-1">
              <Heart size={10} className="fill-rose-500 stroke-none" />
              <span>Divya wellness companion</span>
            </span>
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
              <span>gemini-2.5-flash</span>
            </div>
          </div>
        </header>

        {/* Chat / Hero Body */}
        <div className="flex-1 overflow-y-auto bg-white flex flex-col">
          {messages.length === 0 ? (
            /* HERO SCREEN - SPECIAL Wombcare Assistant Layout */
            <div className="max-w-[800px] mx-auto w-full px-6 pt-16 pb-8 flex flex-col justify-center flex-1">
              
              {/* Prominent Salutation */}
              <div className="mb-10 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-3">
                  Hi {user?.name ? user.name.split(' ')[0] : 'there'}, I'm Divya.
                </h1>
                <p className="text-xl md:text-2xl text-slate-500 font-medium max-w-[600px] mx-auto">
                  Your personalized PCOS, PCOD, PMS & Hormonal wellness companion. How can I help you sync with your body today?
                </p>
              </div>

              {/* Suggestions chips */}
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                {[
                  "Explain managing PCOD bloating",
                  "Suggest hormone balancing breakfast options",
                  "Why is my period cycle irregular?",
                  "Analyze my water and sleep logs today",
                  "Best exercises for menstrual pain relief"
                ].map(p => (
                  <button
                    key={p}
                    onClick={() => handleSuggestedPrompt(p)}
                    className="px-5 py-2.5 bg-[#FFF0F0] hover:bg-[#FFE0E0] text-rose-800 rounded-full text-xs font-semibold border border-rose-100 transition active:scale-[0.98] shadow-sm"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Medical Disclaimer Card with references */}
              <div className="bg-[#FAF6F6] border border-[#F5E2E2] rounded-3xl p-6 text-slate-600 max-w-[680px] mx-auto shadow-sm">
                <div className="flex gap-2 items-start text-rose-700 font-bold mb-3 text-sm">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>Important Medical Disclaimer & Sources</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 mb-4">
                  Divya is an AI wellness coach designed by Wombcare to support your lifestyle modifications, symptom tracking, nutrition, and wellness guidelines. 
                  <strong> She does not replace professional medical advice, diagnosis, or treatment.</strong>
                  Always consult with a Wombcare physician or qualified healthcare expert regarding any medical condition or symptom flares.
                </p>
                <div className="border-t border-[#F5E2E2] pt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400 font-semibold">
                  <span className="flex items-center gap-1">
                    Reference: <a href="https://www.who.int" target="_blank" className="text-rose-600 underline flex items-center gap-0.5">WHO Guidelines <ExternalLink size={8} /></a>
                  </span>
                  <span className="flex items-center gap-1">
                    <a href="https://www.acog.org" target="_blank" className="text-rose-600 underline flex items-center gap-0.5">ACOG Clinical Guidance <ExternalLink size={8} /></a>
                  </span>
                  <span className="flex items-center gap-1">
                    <a href="https://www.endocrine.org" target="_blank" className="text-rose-600 underline flex items-center gap-0.5">Endocrine Society <ExternalLink size={8} /></a>
                  </span>
                </div>
              </div>

            </div>
          ) : (
            /* CONVERSATION LOG SCREEN */
            <div className="w-full flex-1 overflow-y-auto px-6 py-8">
              <div className="max-w-[760px] mx-auto space-y-8">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-4 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Wombcare logo as Divya's profile/avatar in the chat */}
                    {msg.role !== 'user' && (
                      <div className="w-8 h-8 relative rounded-lg overflow-hidden flex items-center justify-center bg-white border border-[#EAD4D4]/40 shrink-0 shadow-sm mt-1">
                        <Image
                          src="/logo.png"
                          alt="Divya Avatar"
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#FAF6F6] text-slate-900 border border-[#F5E2E2]'
                      }`}
                    >
                      {msg.role !== 'user' && (
                        <div className="text-[10px] uppercase font-bold text-rose-600 mb-1 tracking-wider">
                          {msg.sender}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap font-medium">
                        {msg.role === 'model' ? renderFormattedContent(msg.content) : msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 relative rounded-lg overflow-hidden flex items-center justify-center bg-white border border-[#EAD4D4]/40 shrink-0 shadow-sm mt-1 animate-pulse">
                      <Image
                        src="/logo.png"
                        alt="Divya Avatar"
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-[#FAF6F6] text-slate-400 border border-[#F5E2E2] flex items-center gap-2 shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* INPUT & ACTION PANEL (STICKY BOTTOM) */}
          <div className="max-w-[800px] w-full mx-auto px-6 pb-6 mt-auto">
            
            {/* Input Form Box */}
            <div className="relative bg-white border border-[#EAD4D4] rounded-2xl shadow-md p-2 flex flex-col gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask Divya anything about your hormonal balance, cycle health or logs..."
                rows={2}
                className="w-full bg-transparent outline-none resize-none px-3 py-2 text-sm text-slate-800 font-medium placeholder-slate-400"
              />

              {/* Action Buttons Panel */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 px-1">
                <div className="flex items-center gap-1.5">
                  
                  {/* Prompt Library */}
                  <button
                    onClick={() => setShowPromptLibrary(!showPromptLibrary)}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-[#FFF0F0] hover:text-rose-800 text-xs font-semibold rounded-xl text-slate-600 transition"
                  >
                    <BookOpen size={14} />
                    <span>Prompt Library</span>
                  </button>

                  {/* Improve Prompt */}
                  <button
                    onClick={handleImprovePrompt}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-[#FFF0F0] hover:text-rose-800 text-xs font-semibold rounded-xl text-slate-600 transition"
                  >
                    <Sparkles size={14} />
                    <span>Improve Query</span>
                  </button>
                </div>

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    input.trim() && !isLoading
                      ? 'bg-rose-600 text-white shadow active:scale-95'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Prompt Library Dialog Modal */}
      {showPromptLibrary && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-[500px] shadow-xl border border-slate-100 overflow-hidden animate-slide-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-rose-600" />
                <h3 className="font-bold text-slate-800 text-lg">Divya's PCOS/PCOD Prompt Library</h3>
              </div>
              <button
                onClick={() => setShowPromptLibrary(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-2.5 max-h-[350px] overflow-y-auto">
              {promptLibrary.map((pr, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(pr);
                    setShowPromptLibrary(false);
                  }}
                  className="w-full text-left p-3.5 bg-slate-50 hover:bg-rose-50/50 hover:text-rose-900 border border-slate-100 hover:border-rose-100 rounded-2xl text-xs font-semibold text-slate-700 transition"
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
