import { useEffect, useRef, useState } from "react";
import { useSocket, Room, RoomMessage } from "@/lib/socket";
import { getUsername } from "@/lib/storage";
import { ReactionPickerButton, ReactionBar } from "@/components/reaction-picker";
import { TypingIndicator } from "@/components/typing-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send, Loader2, ImageIcon, X, Hash, Lock, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const safeFormat = (ts: string | undefined | null, fmt: string, fallback = "--:--") => {
  try { if (!ts) return fallback; const d = new Date(ts); return isNaN(d.getTime()) ? fallback : format(d, fmt); } catch { return fallback; }
};

interface RoomChatProps {
  room: Room;
  onBack: () => void;
}

export function RoomChat({ room, onBack }: RoomChatProps) {
  const { roomMessages, sendRoomMessage, onlineUsers, startTyping, stopTyping, typingUsers, addReaction, reactionUpdates } = useSocket();
  const [inputText, setInputText] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = getUsername();
  const roomContext = `room:${room.id}`;

  const messages: RoomMessage[] = roomMessages.get(room.id) || [];
  const onlineCount = room.members.filter(m => onlineUsers.some(u => u.username === m)).length;
  const roomTyping = (typingUsers.get(roomContext) || []).filter((u) => u !== currentUser);

  useEffect(() => { setTimeout(() => scrollToBottom(false), 50); }, [messages.length]);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingImageUrl) { sendRoomMessage(room.id, inputText.trim(), pendingImageUrl); setPendingImageUrl(null); setImagePreview(null); setInputText(""); return; }
    if (!inputText.trim()) return;
    sendRoomMessage(room.id, inputText.trim());
    stopTyping(roomContext);
    setInputText("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (e.target.value) startTyping(roomContext); else stopTyping(roomContext);
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
    } catch { setImagePreview(null); setPendingImageUrl(null); toast({ title: "Błąd", description: "Nie udało się przesłać zdjęcia." }); }
    finally { setUploadingImage(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const getReactions = (msgId: string, base?: Record<string, string[]>) => reactionUpdates.get(msgId) ?? base ?? {};

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none h-14 border-b border-border bg-card/60 backdrop-blur flex items-center px-3 gap-3 z-10">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-white shrink-0" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${room.type === "private" ? "bg-primary/15 border border-primary/25" : "bg-white/5 border border-white/10"}`}>
          {room.type === "private" ? <Lock className="w-4 h-4 text-primary/80" /> : <Hash className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate leading-none">{room.name}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3" /> {room.members.length} członków • {onlineCount} online
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 pb-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${room.type === "private" ? "bg-primary/15 border border-primary/25" : "bg-white/5 border border-white/10"}`}>
              {room.type === "private" ? <Lock className="w-6 h-6 text-primary/70" /> : <Hash className="w-6 h-6 text-muted-foreground/50" />}
            </div>
            <p className="text-white font-medium">Witaj w #{room.name}</p>
            <p className="text-muted-foreground text-sm">Zacznij rozmowę!</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isMe = msg.username === currentUser;
          const showHeader = index === 0 || messages[index - 1].username !== msg.username ||
            new Date(msg.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() > 60000;
          const msgReactions = getReactions(msg.id, msg.reactions);
          return (
            <div key={msg.id || index} className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"} ${showHeader ? "mt-4" : "mt-0.5"}`}>
              {showHeader && (
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  <span className={`text-sm font-medium ${isMe ? "text-primary" : "text-accent"}`}>{isMe ? "Ty" : msg.username}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{safeFormat(msg.timestamp, "H:mm")}</span>
                </div>
              )}
              <div className="relative group">
                <div className={`flex items-end gap-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`rounded-2xl text-[15px] leading-relaxed break-words shadow-sm overflow-hidden ${isMe ? "bg-primary/90 text-white rounded-tr-sm shadow-[0_2px_10px_rgba(180,100,255,0.2)]" : "bg-secondary border border-white/5 text-foreground rounded-tl-sm"}`}>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="zdjęcie" className="w-full max-w-[260px] max-h-[320px] object-cover rounded-t-2xl cursor-zoom-in" onClick={() => window.open(msg.imageUrl, "_blank")} />}
                    {msg.text && <p className={`${msg.imageUrl ? "px-4 pt-1 pb-3" : "px-4 py-2.5"}`}>{msg.text}</p>}
                  </div>
                  <ReactionPickerButton messageId={msg.id} messageType="room" reactions={msgReactions} currentUser={currentUser ?? ""} isMe={isMe} />
                </div>
                <ReactionBar messageId={msg.id} messageType="room" reactions={msgReactions} currentUser={currentUser ?? ""} />
              </div>
            </div>
          );
        })}
      </div>

      <TypingIndicator usernames={roomTyping} className="px-3" />

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

      <div className="flex-none p-3 bg-card/95 backdrop-blur border-t border-border pb-safe">
        <form onSubmit={handleSend} className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <Button type="button" variant="ghost" size="icon" className="h-12 w-12 shrink-0 rounded-xl text-muted-foreground hover:text-white hover:bg-secondary border border-white/5" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage || !!imagePreview}>
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Input value={inputText} onChange={handleInputChange} placeholder={`Napisz do #${room.name}...`} className="flex-1 h-12 bg-black/40 border-white/10 text-base focus-visible:ring-primary rounded-xl" autoComplete="off" />
          <Button type="submit" disabled={(!inputText.trim() && !pendingImageUrl) || uploadingImage} size="icon" className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0 shadow-[0_0_15px_rgba(180,100,255,0.3)]">
            <Send className="h-5 w-5 ml-0.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
