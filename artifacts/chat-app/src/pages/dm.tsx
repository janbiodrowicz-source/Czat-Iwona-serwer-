import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useSocket, DmMessage } from "@/lib/socket";
import { getToken, getUsername } from "@/lib/storage";
import { P5Pulse, P5PulseRef } from "@/components/p5-pulse";
import { VideoCall } from "@/components/video-call";
import { ReactionPickerButton, ReactionBar } from "@/components/reaction-picker";
import { TypingIndicator } from "@/components/typing-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Send, Loader2, ImageIcon, X, Download, Bookmark, Video, Phone } from "lucide-react";
import { format } from "date-fns";

const safeFormat = (ts: string | undefined | null, fmt: string, fallback = "--:--") => {
  try { if (!ts) return fallback; const d = new Date(ts); return isNaN(d.getTime()) ? fallback : format(d, fmt); } catch { return fallback; }
};

function ImageActions({ imageUrl }: { imageUrl: string }) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `chat-image-${Date.now()}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a"); a.href = imageUrl; a.download = `chat-image-${Date.now()}.jpg`; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = JSON.parse(localStorage.getItem("savedImages") || "[]") as string[];
    if (!existing.includes(imageUrl)) { existing.push(imageUrl); localStorage.setItem("savedImages", JSON.stringify(existing)); toast({ title: "Zapisano!" }); }
    else toast({ title: "Już zapisano" });
  };
  return (
    <div className="flex gap-1.5 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
      <button onClick={handleDownload} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-white/70 text-[11px] font-medium hover:bg-black/50 hover:text-white transition-colors active:scale-95"><Download className="w-3 h-3" /> Pobierz</button>
      <button onClick={handleSave} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-white/70 text-[11px] font-medium hover:bg-black/50 hover:text-white transition-colors active:scale-95"><Bookmark className="w-3 h-3" /> Zapisz</button>
    </div>
  );
}

export default function Dm() {
  const params = useParams();
  const otherUsername = params.username || "";
  const [, setLocation] = useLocation();
  const {
    isConnected, onlineUsers, sendDm, sendDmImage, dmMessages,
    setCurrentDmPartner, clearUnread, incomingCall, dismissIncomingCall,
    getDmHistory, startTyping, stopTyping, typingUsers, addReaction, reactionUpdates,
  } = useSocket();

  const [inputText, setInputText] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoCallInitialState, setVideoCallInitialState] = useState<"calling" | "incoming">("calling");
  const [activeCallType, setActiveCallType] = useState<"video" | "audio">("video");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const p5PulseRef = useRef<P5PulseRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = getUsername();
  const dmContext = `dm:${[currentUser, otherUsername].sort().join(":")}`;

  useEffect(() => { if (!getToken()) setLocation("/"); }, [setLocation]);

  useEffect(() => {
    setCurrentDmPartner(otherUsername);
    clearUnread(otherUsername);
    getDmHistory(otherUsername);
    setHistoryLoaded(true);
    return () => { setCurrentDmPartner(null); };
  }, [otherUsername, setCurrentDmPartner, clearUnread, getDmHistory]);

  useEffect(() => {
    if (incomingCall && incomingCall.from === otherUsername && !showVideoCall) {
      setVideoCallInitialState("incoming");
      setActiveCallType(incomingCall.callType ?? "video");
      setShowVideoCall(true);
    }
  }, [incomingCall, otherUsername, showVideoCall]);

  const messages: DmMessage[] = dmMessages.get(otherUsername) || [];
  const prevCountRef = useRef(messages.length);
  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      const isNew = messages.length > prevCountRef.current;
      const last = messages[messages.length - 1];
      if (isNew && last.from !== currentUser) p5PulseRef.current?.trigger();
      if (isNew) clearUnread(otherUsername);
      setTimeout(() => scrollToBottom(isNew), 50);
      prevCountRef.current = messages.length;
    }
  }, [messages, currentUser, clearUnread, otherUsername]);

  useEffect(() => {
    if (historyLoaded && messages.length > 0) setTimeout(() => scrollToBottom(false), 100);
  }, [historyLoaded]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    if (pendingImageUrl) { sendDmImage(otherUsername, pendingImageUrl, inputText.trim() || undefined); setPendingImageUrl(null); setImagePreview(null); setInputText(""); return; }
    if (!inputText.trim()) return;
    sendDm(otherUsername, inputText.trim());
    stopTyping(dmContext);
    setInputText("");
    document.getElementById("dm-input")?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (e.target.value) startTyping(dmContext); else stopTyping(dmContext);
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

  const isUserOnline = onlineUsers.some(u => u.username === otherUsername);
  const dmTyping = (typingUsers.get(dmContext) || []).filter((u) => u !== currentUser);
  const getReactions = (msgId: string, base?: Record<string, string[]>) => reactionUpdates.get(msgId) ?? base ?? {};

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
      <P5Pulse ref={p5PulseRef} />
      {showVideoCall && (
        <VideoCall
          partnerUsername={otherUsername}
          initialState={videoCallInitialState}
          callType={activeCallType}
          onClose={() => { setShowVideoCall(false); dismissIncomingCall(); }}
        />
      )}

      <header className="flex-none h-16 border-b border-border bg-card/80 backdrop-blur flex items-center px-4 z-10 gap-3">
        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-white" onClick={() => setLocation("/chat")}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="font-bold text-lg tracking-tight text-white drop-shadow-[0_0_8px_rgba(180,100,255,0.4)] truncate">{otherUsername}</h1>
          <div className={`w-2 h-2 rounded-full shrink-0 ${isUserOnline ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]" : "bg-muted-foreground"}`} />
          <span className="text-xs font-mono text-muted-foreground border-l border-white/10 pl-3 truncate hidden sm:block">jako {currentUser}</span>
        </div>
        <button
          onClick={() => { setActiveCallType("audio"); setVideoCallInitialState("calling"); setShowVideoCall(true); }}
          disabled={!isUserOnline}
          title={isUserOnline ? "Zadzwoń głosowo" : "Użytkownik offline"}
          className="h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground border border-white/10 hover:text-green-400 hover:bg-green-500/10 hover:border-green-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          onClick={() => { setActiveCallType("video"); setVideoCallInitialState("calling"); setShowVideoCall(true); }}
          disabled={!isUserOnline}
          title={isUserOnline ? "Zadzwoń przez wideo" : "Użytkownik offline"}
          className="h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground border border-white/10 hover:text-white hover:bg-secondary hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Video className="h-5 w-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 pb-2 z-10">
        {messages.length === 0 && historyLoaded && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-mono font-bold text-2xl text-primary border border-primary/20 mb-2">{otherUsername.charAt(0).toUpperCase()}</div>
            <p className="font-medium text-white">Brak wiadomości</p>
            <p className="text-sm">Wyślij wiadomość, aby rozpocząć rozmowę</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isMe = msg.from === currentUser;
          const showHeader = index === 0 || messages[index - 1].from !== msg.from ||
            new Date(msg.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() > 60000;
          const msgReactions = getReactions(msg.id, msg.reactions);

          return (
            <div key={msg.id || index} className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"} ${showHeader ? "mt-5" : "mt-0.5"}`}>
              {showHeader && (
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  <span className={`text-sm font-medium ${isMe ? "text-primary" : "text-accent"}`}>{isMe ? "Ty" : msg.from}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{safeFormat(msg.timestamp, "H:mm")}</span>
                </div>
              )}
              <div className="relative group">
                <div className={`flex items-end gap-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`rounded-2xl text-[15px] leading-relaxed break-words shadow-sm overflow-hidden ${isMe ? "bg-primary/90 text-white rounded-tr-sm shadow-[0_2px_10px_rgba(180,100,255,0.2)]" : "bg-secondary border border-white/5 text-foreground rounded-tl-sm"}`}>
                    {msg.imageUrl && (
                      <><img src={msg.imageUrl} alt="zdjęcie" className="w-full max-w-[260px] max-h-[320px] object-cover rounded-t-2xl" onClick={() => window.open(msg.imageUrl, "_blank")} style={{ cursor: "zoom-in" }} />
                        <ImageActions imageUrl={msg.imageUrl} /></>
                    )}
                    {msg.text && <p className={`${msg.imageUrl ? "px-4 pt-1 pb-3" : "px-4 py-2.5"}`}>{msg.text}</p>}
                  </div>
                  <ReactionPickerButton messageId={msg.id} messageType="dm" reactions={msgReactions} currentUser={currentUser} isMe={isMe} />
                </div>
                <ReactionBar messageId={msg.id} messageType="dm" reactions={msgReactions} currentUser={currentUser} />
              </div>
            </div>
          );
        })}
      </div>

      <TypingIndicator usernames={dmTyping} className="px-4" />

      {imagePreview && (
        <div className="flex-none px-4 py-2 bg-card/95 border-t border-border z-20 flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <img src={imagePreview} alt="podgląd" className="w-16 h-16 object-cover rounded-xl border border-white/10" />
            {uploadingImage && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>}
          </div>
          <div className="flex-1"><p className="text-xs text-muted-foreground font-mono">{uploadingImage ? "Wysyłanie..." : "Gotowe"}</p></div>
          <button onClick={() => { setImagePreview(null); setPendingImageUrl(null); }} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-none p-4 bg-card/95 backdrop-blur border-t border-border z-20 pb-safe">
        <form onSubmit={handleSend} className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <Button type="button" variant="ghost" size="icon" className="h-14 w-14 shrink-0 rounded-xl text-muted-foreground hover:text-white hover:bg-secondary border border-white/5" onClick={() => fileInputRef.current?.click()} disabled={!isConnected || uploadingImage || !!imagePreview}>
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input id="dm-input" value={inputText} onChange={handleInputChange} placeholder={pendingImageUrl ? "Dodaj podpis..." : `Napisz do @${otherUsername}...`} className="flex-1 h-14 bg-black/40 border-white/10 text-base focus-visible:ring-primary rounded-xl" autoComplete="off" />
          <Button type="submit" disabled={(!inputText.trim() && !pendingImageUrl) || !isConnected || uploadingImage} size="icon" className="h-14 w-14 rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0 shadow-[0_0_15px_rgba(180,100,255,0.3)] transition-all">
            <Send className="h-6 w-6 ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
