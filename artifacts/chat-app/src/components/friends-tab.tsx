import { useState } from "react";
import { UserPlus, Users, Clock, UserCheck, UserX } from "lucide-react";

export interface FriendRequest {
  from: string;
  to: string;
  status: "pending" | "accepted" | "rejected";
  sentAt: string;
}

export interface Friend {
  username: string;
  since: string;
}

interface FriendsTabProps {
  currentUser: string;
  friends: Friend[];
  sentRequests: FriendRequest[];
  receivedRequests: FriendRequest[];
  onAccept: (from: string) => void;
  onReject: (from: string) => void;
  onCancelRequest?: (to: string) => void;
  onRemoveFriend?: (username: string) => void;
}

const btnStyle = "flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-white text-[11px] font-mono font-semibold hover:bg-primary/30 transition-colors";
const btnDangerStyle = "flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-destructive/20 border border-destructive/40 text-white text-[11px] font-mono font-semibold hover:bg-destructive/30 transition-colors";

export function FriendsTab({ friends, sentRequests, receivedRequests, onAccept, onReject, onCancelRequest, onRemoveFriend }: FriendsTabProps) {
  const [subTab, setSubTab] = useState<"friends" | "pending">("friends");
  const [confirmAction, setConfirmAction] = useState<{type: "cancel" | "remove"; username: string} | null>(null);
  const [pendingTab, setPendingTab] = useState<"received" | "sent">("received");

  return (
    <div className="flex flex-col h-full">
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setConfirmAction(null)}>
          <div className="bg-card border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-white font-semibold text-center mb-1">
              {confirmAction.type === "cancel" ? "Anuluj zaproszenie" : "Usuń znajomego"}
            </p>
            <p className="text-muted-foreground text-sm text-center mb-5">
              {confirmAction.type === "cancel"
                ? `Czy na pewno chcesz anulować zaproszenie do ${confirmAction.username}?`
                : `Czy na pewno chcesz usunąć ${confirmAction.username} ze znajomych?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-mono font-semibold hover:bg-white/20 transition-colors">NIE</button>
              <button onClick={() => {
                if (confirmAction.type === "cancel" && onCancelRequest) onCancelRequest(confirmAction.username);
                if (confirmAction.type === "remove" && onRemoveFriend) onRemoveFriend(confirmAction.username);
                setConfirmAction(null);
              }} className="flex-1 py-2.5 rounded-full bg-destructive/20 border border-destructive/40 text-white text-sm font-mono font-semibold hover:bg-destructive/30 transition-colors">TAK</button>
            </div>
          </div>
        </div>
      )}
      {/* Sub-tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setSubTab("friends")}
          className={`flex-1 py-2.5 text-[11px] font-mono font-semibold tracking-wider transition-colors flex items-center justify-center gap-1.5 ${subTab === "friends" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          ZNAJOMI
          {friends.length > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{friends.length}</span>}
        </button>
        <button
          onClick={() => setSubTab("pending")}
          className={`flex-1 py-2.5 text-[11px] font-mono font-semibold tracking-wider transition-colors flex items-center justify-center gap-1.5 ${subTab === "pending" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
        >
          <Clock className="w-3.5 h-3.5" />
          OCZEKUJĄCE
          {(receivedRequests.length + sentRequests.length) > 0 && (
            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">
              {receivedRequests.length + sentRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friends list */}
      {subTab === "friends" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Brak znajomych</p>
              <p className="text-muted-foreground/60 text-xs">Zaproś kogoś z zakładki Użytkownicy</p>
            </div>
          ) : (
            friends.map((f) => (
              <div key={f.username} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-white/5">
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-mono font-bold text-primary text-sm shrink-0">
                  {f.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{f.username}</p>
                  <p className="text-muted-foreground text-[10px] font-mono">Znajomy od {new Date(f.since).toLocaleDateString("pl-PL")}</p>
                </div>
                {onRemoveFriend && (
                  <button onClick={() => setConfirmAction({type: "remove", username: f.username})} className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-white text-[10px] font-mono hover:bg-destructive/25 transition-colors shrink-0">
                    Usuń
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending */}
      {subTab === "pending" && (
        <div className="flex flex-col h-full">
          <div className="flex border-b border-border/50 shrink-0 px-3 pt-2">
            <button
              onClick={() => setPendingTab("received")}
              className={`flex-1 py-2 text-[10px] font-mono font-semibold tracking-wider transition-colors flex items-center justify-center gap-1 ${pendingTab === "received" ? "text-orange-400 border-b-2 border-orange-400" : "text-muted-foreground hover:text-white"}`}
            >
              OTRZYMANE
              {receivedRequests.length > 0 && (
                <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full text-[9px] font-bold">{receivedRequests.length}</span>
              )}
            </button>
            <button
              onClick={() => setPendingTab("sent")}
              className={`flex-1 py-2 text-[10px] font-mono font-semibold tracking-wider transition-colors flex items-center justify-center gap-1 ${pendingTab === "sent" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
            >
              WYSŁANE
              {sentRequests.length > 0 && (
                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[9px] font-bold">{sentRequests.length}</span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {pendingTab === "received" && (
              receivedRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Clock className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Brak otrzymanych zaproszeń</p>
                </div>
              ) : (
                receivedRequests.map((r) => (
                  <div key={r.from} className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
                    <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center font-mono font-bold text-orange-400 text-sm shrink-0">
                      {r.from.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{r.from}</p>
                      <p className="text-muted-foreground text-[10px] font-mono">Chce być Twoim znajomym</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => onAccept(r.from)} className={btnStyle}>
                        <UserCheck className="w-3 h-3" /> Tak
                      </button>
                      <button onClick={() => onReject(r.from)} className={btnDangerStyle}>
                        <UserX className="w-3 h-3" /> Nie
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {pendingTab === "sent" && (
              sentRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <UserPlus className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Brak wysłanych zaproszeń</p>
                </div>
              ) : (
                sentRequests.map((r) => (
                  <div key={r.to} className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                    <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-mono font-bold text-primary text-sm shrink-0">
                      {r.to.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{r.to}</p>
                      <p className="text-muted-foreground text-[10px] font-mono">Zaproszenie oczekuje</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-primary/60 bg-primary/10 px-2 py-1 rounded-full border border-primary/20">OCZEKUJE</span>
                      {onCancelRequest && (
                        <button onClick={() => setConfirmAction({type: "cancel", username: r.to})} className="text-[10px] font-mono px-2 py-1 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors">
                          Anuluj
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
