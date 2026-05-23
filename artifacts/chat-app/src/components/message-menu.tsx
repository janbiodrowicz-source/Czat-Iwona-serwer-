import { useState, useRef, useEffect } from "react";
import { Copy, Trash2, Reply, Share2 } from "lucide-react";

const QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🔥"];

interface MessageMenuProps {
  messageId: string;
  text?: string;
  imageUrl?: string;
  isOwn: boolean;
  onDelete?: () => void;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  children: React.ReactNode;
}

export function MessageMenu({ messageId, text, imageUrl, isOwn, onDelete, onReply, onReact, children }: MessageMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleLongPress = () => {
    timerRef.current = setTimeout(() => setOpen(true), 500);
  };
  const cancelLongPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleCopy = () => {
    if (text) navigator.clipboard?.writeText(text);
    setOpen(false);
  };

  const handleShare = () => {
    const shareText = text || imageUrl || "";
    if (navigator.share) {
      navigator.share({ text: shareText, url: imageUrl || window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div
        onMouseDown={handleLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={handleLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
      >
        {children}
      </div>

      {open && (
        <div className={`absolute z-50 bottom-full mb-2 ${isOwn ? "right-0" : "left-0"} bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[180px]`}>
          {/* Quick reactions */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/10">
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReact?.(emoji); setOpen(false); }}
                className="text-xl hover:scale-125 transition-transform active:scale-95 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          {/* Actions */}
          <div className="py-1">
            {onReply && (
              <button onClick={() => { onReply(); setOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
                <Reply className="w-4 h-4 text-primary" /> Odpowiedz
              </button>
            )}
            {text && (
              <button onClick={handleCopy} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
                <Copy className="w-4 h-4 text-primary" /> Kopiuj
              </button>
            )}
            <button onClick={handleShare} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
              <Share2 className="w-4 h-4 text-primary" /> Udostępnij
            </button>
            {isOwn && onDelete && (
              <button onClick={() => { onDelete(); setOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/10 mt-1">
                <Trash2 className="w-4 h-4" /> Usuń
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
