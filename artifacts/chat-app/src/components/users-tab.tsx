import { useState } from "react";
import { useLocation } from "wouter";
import { useSocket } from "@/lib/socket";
import { getUsername, getAvatar } from "@/lib/storage";
import { ChevronRight, Search, UserX, Ban, VolumeX, Volume2, UserPlus, Home } from "lucide-react";
import { format } from "date-fns";

const safeFormat = (ts: string | undefined | null, fmt: string, fallback = "--") => {
  try { if (!ts) return fallback; const d = new Date(ts); return isNaN(d.getTime()) ? fallback : format(d, fmt); } catch { return fallback; }
};

const BOT_USERNAMES = new Set(["Bot_Ania", "Bot_Marek", "Bot_Support"]);
const btnStyle = "flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-white text-[11px] font-mono font-semibold hover:bg-primary/30 transition-colors";

function UserAvatar({ username, isOnline, size = "md" }: { username: string; isOnline: boolean; size?: "sm" | "md" | "lg" }) {
  const avatar = getAvatar(username);
  const sizeClasses = size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-14 h-14 text-2xl" : "w-10 h-10 text-base";
  const ringClass = isOnline ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "";

  return (
    <div className={`relative shrink-0 ${sizeClasses} rounded-full overflow-hidden ${ringClass}`}>
      {avatar ? (
        <img src={avatar} alt={username} className={`w-full h-full object-cover ${isOnline ? "" : "grayscale brightness-50"}`} />
      ) : (
        <div className={`w-full h-full rounded-full bg-secondary flex items-center justify-center font-mono font-bold text-primary border ${isOnline ? "border-primary/40" : "border-white/10"}`}>
          <span className={isOnline ? "" : "opacity-40"}>{username.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
    </div>
  );
}

export { UserAvatar };

interface InviteConfirmProps {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function InviteConfirm({ username, onConfirm, onCancel }: InviteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6" onClick={onCancel}>
      <div className="bg-card border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-semibold text-center mb-1">Zaproszenie do znajomych</p>
        <p className="text-muted-foreground text-sm text-center mb-5">
          Czy na pewno chcesz zaprosić <span className="text-primary font-semibold">{username}</span> do znajomych?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-mono font-semibold hover:bg-white/20 transition-colors">
            NIE
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-full bg-primary/20 border border-primary/40 text-white text-sm font-mono font-semibold hover:bg-primary/30 transition-colors">
            TAK
          </button>
        </div>
      </div>
    </div>
  );
}

interface UsersTabProps {
  onSetDefault?: () => void;
  defaultIsGlobal?: boolean;
  sentFriendRequests?: Set<string>;
  friends?: Set<string>;
  onSendFriendRequest?: (username: string) => void;
}

export function UsersTab({ onSetDefault, defaultIsGlobal, sentFriendRequests = new Set(), friends = new Set(), onSendFriendRequest }: UsersTabProps) {
  const [, setLocation] = useLocation();
  const { onlineUsers, isAdmin, kickUser, banUser, muteUser, mutedUsernames, bannedUsernames, unreadDmCounts } = useSocket();
  const [search, setSearch] = useState("");
  const [confirmInvite, setConfirmInvite] = useState<string | null>(null);
  const currentUser = getUsername();

  const filtered = onlineUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleInviteConfirm = () => {
    if (confirmInvite && onSendFriendRequest) {
      onSendFriendRequest(confirmInvite);
    }
    setConfirmInvite(null);
  };

  return (
    <div className="flex flex-col h-full">
      {confirmInvite && (
        <InviteConfirm
          username={confirmInvite}
          onConfirm={handleInviteConfirm}
          onCancel={() => setConfirmInvite(null)}
        />
      )}

      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj użytkowników..."
            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-all"
          />
        </div>
      </div>

      <div className="px-3 pb-1 flex items-center justify-between">
        <p className="text-[10px] font-mono text-muted-foreground px-1">
          ONLINE — {onlineUsers.length}
        </p>
        {onSetDefault && (
          <button
            onClick={onSetDefault}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold transition-colors border ${defaultIsGlobal ? "bg-primary/30 border-primary/50 text-white" : "bg-primary/20 border-primary/40 text-white hover:bg-primary/30"}`}
          >
            <Home className="w-3 h-3" />
            {defaultIsGlobal ? "GŁÓWNY ✓" : "USTAW JAKO GŁÓWNY"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">Brak wyników</p>
        ) : (
          filtered.map((user) => {
            const unreadCount = unreadDmCounts.get(user.username) || 0;
            const isSelf = user.username === currentUser;
            const isMuted = mutedUsernames.has(user.username);
            const isBanned = bannedUsernames.has(user.username);
            const isFriend = friends.has(user.username);
            const hasSentRequest = sentFriendRequests.has(user.username);

            return (
              <div key={user.socketId} className="rounded-xl overflow-hidden">
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl ${!isSelf ? "cursor-pointer hover:bg-secondary/60 active:bg-secondary transition-colors" : ""}`}
                  onClick={() => { if (!isSelf) setLocation(`/dm/${user.username}`); }}
                >
                  <div className="relative">
                    <UserAvatar username={user.username} isOnline={true} />
                    {!isSelf && unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-[0_0_8px_rgba(180,100,255,0.8)] z-10">
                        {unreadCount}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium text-white text-sm flex items-center gap-1.5 flex-wrap">
                      {user.username}
                      {isSelf && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono">TY</span>}
                      {BOT_USERNAMES.has(user.username) && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-mono">BOT</span>}
                      {isMuted && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded font-mono">WYCISZONY</span>}
                      {isBanned && <span className="text-[10px] bg-destructive/20 text-destructive px-1 py-0.5 rounded font-mono">ZBANOWANY</span>}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Dołączył(a) {safeFormat(user.joinedAt, "H:mm")}</span>
                  </div>
                  {/* Friend invite button */}
                  {!isSelf && !isFriend && !hasSentRequest && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmInvite(user.username); }}
                      className={btnStyle}
                      title="Zaproś do znajomych"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isSelf && isFriend && (
                    <span className="text-[10px] font-mono text-green-400/60 px-1">✓</span>
                  )}
                  {!isSelf && hasSentRequest && !isFriend && (
                    <span className="text-[10px] font-mono text-primary/60 bg-primary/10 px-2 py-1 rounded-full border border-primary/20">WYSŁANO</span>
                  )}
                  {!isSelf && !isAdmin && !hasSentRequest && !isFriend && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  )}
                </div>

                {isAdmin && !isSelf && (
                  <div className="flex gap-1.5 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => kickUser(user.username)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-white text-[11px] font-mono font-semibold hover:bg-yellow-500/30 transition-colors">
                      <UserX className="w-3 h-3" /> Wyrzuć
                    </button>
                    <button onClick={() => banUser(user.username)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-destructive/20 border border-destructive/40 text-white text-[11px] font-mono font-semibold hover:bg-destructive/30 transition-colors">
                      <Ban className="w-3 h-3" /> Banuj
                    </button>
                    <button onClick={() => muteUser(user.username)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-mono font-semibold transition-colors ${isMuted ? "bg-orange-500/30 border-orange-500/50 text-white hover:bg-orange-500/40" : "bg-orange-500/20 border-orange-500/40 text-white hover:bg-orange-500/30"}`}>
                      {isMuted ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                      {isMuted ? "Odcisz" : "Wycisz"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
