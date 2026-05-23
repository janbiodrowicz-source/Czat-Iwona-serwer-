import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useSocket, ChatMessage } from "@/lib/socket";
import { getToken, getUsername } from "@/lib/storage";
import { P5Pulse, P5PulseRef } from "@/components/p5-pulse";
import { UserPanel } from "@/components/user-panel";
import { RoomsTab } from "@/components/rooms-tab";
import { UsersTab } from "@/components/users-tab";
import type { Friend, FriendRequest } from "@/components/friends-tab";
import { RoomChat } from "@/components/room-chat";
import { VideoCall } from "@/components/video-call";
import { ReactionPickerButton, ReactionBar } from "@/components/reaction-picker";
import { TypingIndicator } from "@/components/typing-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Send, Loader2, Trash2, ShieldCheck, ImageIcon, X,
  Download, Bookmark, User, MessageSquare, Hash, Users, LogOut, Search, Home,
} from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { MessageMenu } from "@/components/message-menu";
import { format } from "date-fns";
import { Room } from "@/lib/socket";

const safeFormat = (ts: string | undefined | null, fmt: string, fallback = "--:--") => {
  try { if (!ts) return fallback; const d = new Date(ts); return isNaN(d.getTime()) ? fallback : format(d, fmt); } catch { return fallback; }
};

type Tab = "chat" | "rooms" | "users";

function ImageActions({ imageUrl }: { imageUrl: string }) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `chat-image-${Date.now()}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a");
      a.href = imageUrl; a.download = `chat-image-${Date.now()}.jpg`; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = JSON.parse(localStorage.getItem("savedImages") || "[]") as string[];
    if (!existing.includes(imageUrl)) {
      existing.push(imageUrl);
      localStorage.setItem("savedImages", JSON.stringify(existing));
      toast({ title: "Zapisano!", description: "Zdjęcie zostało dodane do galerii." });
    } else {
      toast({ title: "Już zapisano", description: "To zdjęcie jest już w galerii." });
    }
  };
  return (
    <div className="flex gap-1.5 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
      <button onClick={handleDownload} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-white/70 text-[11px] font-medium hover:bg-black/50 hover:text-white transition-colors active:scale-95">
        <Download className="w-3 h-3" /> Pobierz
      </button>
      <button onClick={handleSave} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-white/70 text-[11px] font-medium hover:bg-black/50 hover:text-white transition-colors active:scale-95">
        <Bookmark className="w-3 h-3" /> Zapisz
      </button>
    </div>
  );
}

export default function Chat() {
  const [, setLocation] = useLocation();
  const {
    socket, isConnected, onlineUsers, sendMessage, sendImage, logout,
    isAdmin, kickUser, banUser, muteUser, mutedUsernames, bannedUsernames,
    rooms, unreadDmCounts, incomingCall, rejectCall, dismissIncomingCall,
    botsEnabled, startBots, stopBots, roomInvite, setRoomInvite, testReport,
    startTyping, stopTyping, typingUsers, addReaction, reactionUpdates,
  } = useSocket();

  const [globalVideoCall, setGlobalVideoCall] = useState<{ partner: string } | null>(null);
  useEffect(() => {
    if (incomingCall) setGlobalVideoCall({ partner: incomingCall.from });
  }, [incomingCall]);

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [defaultView, setDefaultView] = useState<"global" | string>(() => localStorage.getItem("defaultView") || "global");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentFriendRequests, setSentFriendRequests] = useState<FriendRequest[]>([]);
  const [receivedFriendRequests, setReceivedFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const p5PulseRef = useRef<P5PulseRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = getUsername();

  useEffect(() => { if (!getToken()) setLocation("/"); }, [setLocation]);

  // Handle incoming friend requests from bots
  useEffect(() => {
    if (!socket) return;
    const onFriendRequest = ({ from }: { from: string }) => {
      setReceivedFriendRequests(prev => {
        if (prev.some(r => r.from === from)) return prev;
        return [...prev, { from, to: currentUser || "", status: "pending", sentAt: new Date().toISOString() }];
      });
    };
    socket.on("friend_request", onFriendRequest);
    return () => { socket.off("friend_request", onFriendRequest); };
  }, [socket, currentUser]);

  // Apply default view on startup
  useEffect(() => {
    const saved = localStorage.getItem("defaultView");
    if (saved && saved !== "global") {
      setActiveRoomId(saved);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onHistory = (history: ChatMessage[]) => { setMessages(history); setTimeout(() => scrollToBottom(false), 50); };
    const onNew = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.username !== currentUser && msg.username !== "__system__") p5PulseRef.current?.trigger();
      setTimeout(() => scrollToBottom(true), 50);
    };
    const onDeleted = ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSelectedMsgId((cur) => (cur === id ? null : cur));
    };
    socket.on("message_history", onHistory);
    socket.on("new_message", onNew);
    socket.on("message_deleted", onDeleted);
    return () => { socket.off("message_history", onHistory); socket.off("new_message", onNew); socket.off("message_deleted", onDeleted); };
  }, [socket, currentUser]);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    if (pendingImageUrl) { sendImage(pendingImageUrl, inputText.trim() || undefined); setPendingImageUrl(null); setImagePreview(null); setInputText(""); return; }
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    stopTyping("global");
    setInputText("");
    document.getElementById("chat-input")?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (e.target.value) startTyping("global"); else stopTyping("global");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    setPendingImageUrl(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const { url } = await res.json() as { url: string };
      setPendingImageUrl(url);
    } catch { setImagePreview(null); setPendingImageUrl(null); alert("Nie udało się przesłać zdjęcia."); }
    finally { setUploadingImage(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDeleteMessage = (msgId: string) => { socket?.emit("delete_message", { id: msgId }); setSelectedMsgId(null); };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setSearchLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=global`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { results: ChatMessage[] };
      setSearchResults(data.results || []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, [searchQuery]);

  const handleSetDefault = (view: "global" | string) => {
    localStorage.setItem("defaultView", view);
    setDefaultView(view);
  };

  const handleSendFriendRequest = (toUsername: string) => {
    const newReq: FriendRequest = { from: currentUser || "", to: toUsername, status: "pending", sentAt: new Date().toISOString() };
    setSentFriendRequests(prev => [...prev.filter(r => r.to !== toUsername), newReq]);
  };

  const handleAcceptFriend = (fromUsername: string) => {
    const req = receivedFriendRequests.find(r => r.from === fromUsername);
    if (req) {
      setFriends(prev => [...prev, { username: fromUsername, since: new Date().toISOString() }]);
      setReceivedFriendRequests(prev => prev.filter(r => r.from !== fromUsername));
    }
  };

  const handleRejectFriend = (fromUsername: string) => {
    setReceivedFriendRequests(prev => prev.filter(r => r.from !== fromUsername));
  };

  const globalTyping = (typingUsers.get("global") || []).filter((u) => u !== currentUser);
  const activeRoom: Room | undefined = activeRoomId ? rooms.find(r => r.id === activeRoomId) : undefined;
  const totalUnreadDms = Array.from(unreadDmCounts.values()).reduce((s, n) => s + n, 0);

  const getReactions = (msgId: string, baseReactions?: Record<string, string[]>) =>
    reactionUpdates.get(msgId) ?? baseReactions ?? {};

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative" onClick={() => setSelectedMsgId(null)}>
      <P5Pulse ref={p5PulseRef} />
      <UserPanel open={panelOpen} onClose={() => setPanelOpen(false)} username={currentUser || ""} isAdmin={isAdmin} messages={messages} onlineUsers={onlineUsers} friends={friends} sentRequests={sentFriendRequests} receivedRequests={receivedFriendRequests} onAcceptFriend={handleAcceptFriend} onRejectFriend={handleRejectFriend} onCancelFriendRequest={(to) => setSentFriendRequests(prev => prev.filter(r => r.to !== to))} onRemoveFriend={(username) => setFriends(prev => prev.filter(f => f.username !== username))} />

      {globalVideoCall && (
        <VideoCall
          partnerUsername={globalVideoCall.partner}
          initialState="incoming"
          callType={incomingCall?.callType ?? "video"}
          onClose={() => { setGlobalVideoCall(null); dismissIncomingCall(); }}
        />
      )}

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur flex flex-col p-4" onClick={() => setShowSearch(false)}>
          <div className="flex gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Szukaj w czacie..."
              className="flex-1 h-12 bg-black/40 border-white/10 focus-visible:ring-primary rounded-xl"
            />
            <Button onClick={handleSearch} disabled={searchLoading} className="h-12 px-4 bg-primary rounded-xl">
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" onClick={() => { setShowSearch(false); setSearchResults(null); setSearchQuery(""); }} className="h-12 px-4 rounded-xl">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2" onClick={(e) => e.stopPropagation()}>
            {searchResults === null && <p className="text-muted-foreground text-center text-sm mt-8">Wpisz frazę i naciśnij Enter</p>}
            {searchResults?.length === 0 && <p className="text-muted-foreground text-center text-sm mt-8">Brak wyników</p>}
            {searchResults?.map((msg) => (
              <div key={msg.id} className="bg-card/60 border border-white/5 rounded-xl px-4 py-3">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-medium text-accent">{msg.username}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{safeFormat(msg.timestamp, "d MMM, H:mm")}</span>
                </div>
                <p className="text-sm text-foreground">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-none h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="font-bold text-lg tracking-tight" style={{ color: "#fff", textShadow: "0 0 8px rgba(180,100,255,0.9), 0 0 20px rgba(180,100,255,0.5)" }}>Chat Iwona</h1>
          {activeTab === "chat" && !activeRoom && (
            <button
              onClick={() => handleSetDefault("global")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-colors border ${defaultView === "global" ? "bg-primary/30 border-primary/50 text-white" : "bg-primary/20 border-primary/40 text-white hover:bg-primary/30"}`}
            >
              <Home className="w-3 h-3" />
              <span>{defaultView === "global" ? "GŁÓWNY ✓" : "USTAW JAKO GŁÓWNY"}</span>
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setPanelOpen(true); }} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] font-mono font-bold hover:bg-primary/30 transition-colors">
            {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}<span>{isAdmin ? "ADMINISTRATOR" : "MÓJ PROFIL"}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "chat" && !activeRoom && (
            <button onClick={(e) => { e.stopPropagation(); setShowSearch(true); }} className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-secondary/80 transition-colors" title="Szukaj">
              <Search className="w-4 h-4" />
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary border border-white/5 text-muted-foreground text-xs font-mono hover:text-white hover:border-white/20 hover:bg-secondary/80 transition-all active:scale-95">
            <LogOut className="w-3.5 h-3.5" /> WYLOGUJ
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeRoom ? (
          <RoomChat room={activeRoom} onBack={() => setActiveRoomId(null)} />
        ) : (
          <>
            {activeTab === "chat" && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 pb-2 z-10">
                  {messages.map((msg, index) => {
                    const isSystem = msg.username === "__system__";
                    const isMe = msg.username === currentUser;
                    const isSelected = selectedMsgId === msg.id;
                    const canDelete = isMe || isAdmin;
                    const msgReactions = getReactions(msg.id, msg.reactions);

                    if (isSystem) {
                      return (
                        <div key={msg.id || index} className="flex justify-center my-4">
                          <span className="text-xs font-mono text-muted-foreground/70 italic bg-secondary/50 px-3 py-1 rounded-full border border-white/5">{msg.text}</span>
                        </div>
                      );
                    }

                    const showHeader = index === 0 || messages[index - 1].username !== msg.username ||
                      new Date(msg.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() > 60000;

                    return (
                      <div key={msg.id || index} className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"} ${showHeader ? "mt-5" : "mt-0.5"}`}>
                        {showHeader && (
                          <div className="flex items-baseline gap-2 mb-1 px-1">
                            <span className={`text-sm font-medium ${isMe ? "text-primary" : "text-accent"}`}>{isMe ? "Ty" : msg.username}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{safeFormat(msg.timestamp, "H:mm")}</span>
                          </div>
                        )}
                        <div className="relative group">
                          {canDelete && isSelected && (
                            <div className="absolute -top-9 right-0 z-30 animate-in fade-in slide-in-from-bottom-1 duration-150" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleDeleteMessage(msg.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive text-white text-xs font-semibold shadow-lg hover:bg-destructive/90">
                                <Trash2 className="w-3.5 h-3.5" /> {isMe ? "Usuń dla wszystkich" : "Usuń (Admin)"}
                              </button>
                            </div>
                          )}
                          <div className={`flex items-end gap-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                            <div
                              onClick={(e) => { e.stopPropagation(); if (canDelete) setSelectedMsgId((cur) => (cur === msg.id ? null : msg.id)); }}
                              className={`rounded-2xl text-[15px] leading-relaxed break-words shadow-sm transition-all duration-150 overflow-hidden
                                ${isMe
                                  ? `bg-primary/90 text-white rounded-tr-sm shadow-[0_2px_10px_rgba(180,100,255,0.2)] ${canDelete ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-destructive/70 opacity-90" : "hover:opacity-95"}`
                                  : `bg-secondary border border-white/5 text-foreground rounded-tl-sm ${isAdmin ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-destructive/70 opacity-90" : ""}`
                                }`}
                            >
                              {msg.imageUrl && (
                                <><img src={msg.imageUrl} alt="zdjęcie" className="w-full max-w-[260px] max-h-[320px] object-cover rounded-t-2xl" onClick={(e) => { e.stopPropagation(); window.open(msg.imageUrl, "_blank"); }} style={{ cursor: "zoom-in" }} />
                                  <ImageActions imageUrl={msg.imageUrl} /></>
                              )}
                              {msg.text && <p className={`${msg.imageUrl ? "px-4 pt-1 pb-3" : "px-4 py-2.5"}`}>{msg.text}</p>}
                            </div>
                            <ReactionPickerButton messageId={msg.id} messageType="global" reactions={msgReactions} currentUser={currentUser} isMe={isMe} />
                          </div>
                          <ReactionBar messageId={msg.id} messageType="global" reactions={msgReactions} currentUser={currentUser} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <TypingIndicator usernames={globalTyping} className="px-4" />

                {imagePreview && (
                  <div className="flex-none px-4 py-2 bg-card/95 border-t border-border flex items-center gap-3">
                    <div className="relative w-14 h-14 shrink-0">
                      <img src={imagePreview} alt="podgląd" className="w-14 h-14 object-cover rounded-xl border border-white/10" />
                      {uploadingImage && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
                    </div>
                    <div className="flex-1"><p className="text-xs text-muted-foreground font-mono">{uploadingImage ? "Wysyłanie..." : "Gotowe"}</p></div>
                    <button onClick={() => { setImagePreview(null); setPendingImageUrl(null); }} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                )}

                <div className="flex-none p-3 bg-card/95 backdrop-blur border-t border-border">
                  <form onSubmit={handleSend} className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <Button type="button" variant="ghost" size="icon" className="h-12 w-12 shrink-0 rounded-xl text-muted-foreground hover:text-white hover:bg-secondary border border-white/5" onClick={() => fileInputRef.current?.click()} disabled={!isConnected || uploadingImage || !!imagePreview}>
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                    <Input id="chat-input" value={inputText} onChange={handleInputChange} placeholder={pendingImageUrl ? "Dodaj podpis..." : "Napisz wiadomość..."} className="flex-1 h-12 bg-black/40 border-white/10 text-base focus-visible:ring-primary rounded-xl" autoComplete="off" data-testid="input-message" />
                    <Button type="submit" disabled={(!inputText.trim() && !pendingImageUrl) || !isConnected || uploadingImage} size="icon" className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0 shadow-[0_0_15px_rgba(180,100,255,0.3)]" data-testid="button-send">
                      <Send className="h-5 w-5 ml-0.5" />
                    </Button>
                  </form>
                </div>
              </>
            )}

            {activeTab === "rooms" && <RoomsTab onEnterRoom={(roomId) => setActiveRoomId(roomId)} onSetRoomDefault={(roomId) => handleSetDefault(roomId)} defaultRoomId={defaultView !== "global" ? defaultView : null} />}
            {activeTab === "users" && <UsersTab
                onSetDefault={() => handleSetDefault("global")}
                defaultIsGlobal={defaultView === "global"}
                sentFriendRequests={new Set(sentFriendRequests.map(r => r.to))}
                friends={new Set(friends.map(f => f.username))}
                onSendFriendRequest={handleSendFriendRequest}
              />}
          </>
        )}
      </div>

      {!activeRoom && (
        <nav className="flex-none border-t border-border bg-card/95 backdrop-blur z-20 pb-safe-bottom">
          <div className="flex items-center justify-around py-2">
            {([
              { key: "chat", icon: <MessageSquare className="w-5 h-5" />, label: "CZAT" },
              { key: "rooms", icon: <Hash className="w-5 h-5" />, label: "POKOJE" },
              { key: "users", icon: <Users className="w-5 h-5" />, label: "UŻYTKOWNICY" },
            ] as { key: Tab; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all ${activeTab === key ? "text-white" : "text-muted-foreground hover:text-white/70"}`}>
                <div className={`relative p-2 rounded-xl transition-all ${activeTab === key ? (key === "chat" ? "bg-primary/20 border border-primary/40" : "bg-white/15 border border-white/30") : "border border-transparent"}`}>
                  {icon}
                  {key === "users" && totalUnreadDms > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5 shadow-[0_0_8px_rgba(180,100,255,0.8)]">{totalUnreadDms}</span>}
                  {key === "rooms" && rooms.length > 0 && activeTab !== "rooms" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white/60 rounded-full" />}
                </div>
                <span className="text-[10px] font-mono font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
