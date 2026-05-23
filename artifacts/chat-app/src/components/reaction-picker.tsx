import { useState, useRef, useEffect } from "react";
import { useSocket } from "@/lib/socket";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥"];

interface ReactionPickerProps {
  messageId: string;
  messageType: "global" | "room" | "dm";
  reactions: Record<string, string[]>;
  currentUser: string;
  isMe: boolean;
}

export function ReactionBar({ messageId, messageType, reactions, currentUser }: Omit<ReactionPickerProps, "isMe">) {
  const { addReaction } = useSocket();
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1 px-1">
      {entries.map(([emoji, users]) => {
        const isMine = users.includes(currentUser);
        return (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); addReaction(messageId, messageType, emoji); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all active:scale-95
              ${isMine
                ? "bg-primary/30 border border-primary/60 text-white shadow-[0_0_6px_rgba(180,100,255,0.3)]"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            title={users.join(", ")}
          >
            {emoji} <span className="text-[10px]">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ReactionPickerButton({ messageId, messageType, reactions, currentUser, isMe }: ReactionPickerProps) {
  const { addReaction } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white text-sm px-1.5 py-0.5 rounded-full hover:bg-white/10"
        title="Dodaj reakcję"
      >
        😊
      </button>
      {open && (
        <div
          className={`absolute z-50 bottom-8 ${isMe ? "right-0" : "left-0"} bg-card border border-white/10 rounded-2xl shadow-2xl p-2 flex gap-1 animate-in fade-in zoom-in-95 duration-100`}
          onClick={(e) => e.stopPropagation()}
        >
          {EMOJIS.map((emoji) => {
            const users = reactions[emoji] ?? [];
            const isMine = users.includes(currentUser);
            return (
              <button
                key={emoji}
                onClick={() => { addReaction(messageId, messageType, emoji); setOpen(false); }}
                className={`text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-90 transition-all ${isMine ? "bg-primary/20 ring-1 ring-primary/50" : ""}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
