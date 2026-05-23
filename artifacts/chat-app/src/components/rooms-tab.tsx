import { useState } from "react";
import { useSocket, Room } from "@/lib/socket";
import { getUsername } from "@/lib/storage";
import { Hash, Lock, Plus, ChevronRight, Users, X, Globe, Trash2, Home } from "lucide-react";
import { format } from "date-fns";

const safeFormat = (ts: string | undefined | null, fmt: string, fallback = "--") => {
  try { if (!ts) return fallback; const d = new Date(ts); return isNaN(d.getTime()) ? fallback : format(d, fmt); } catch { return fallback; }
};

interface RoomsTabProps {
  onEnterRoom: (roomId: string) => void;
  onSetRoomDefault?: (roomId: string) => void;
  defaultRoomId?: string | null;
}

function CreateRoomDialog({ onClose }: { onClose: () => void }) {
  const { createRoom } = useSocket();
  const [name, setName] = useState("");
  const [type, setType] = useState<"public" | "private">("public");

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom(name.trim(), type);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-mono">DODAJ POKÓJ</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">NAZWA POKOJU</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="np. Ogólny, Gaming..."
              maxLength={50}
              autoFocus
              className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">WIDOCZNOŚĆ</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType("public")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                  type === "public"
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-secondary/50 border-white/10 text-muted-foreground hover:border-white/20"
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs font-mono">OTWARTY</span>
                <span className="text-[10px] text-muted-foreground leading-tight text-center">Wszyscy mogą dołączyć</span>
              </button>
              <button
                onClick={() => setType("private")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                  type === "private"
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-secondary/50 border-white/10 text-muted-foreground hover:border-white/20"
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="text-xs font-mono">ZAMKNIĘTY</span>
                <span className="text-[10px] text-muted-foreground leading-tight text-center">Tylko zaproszeni</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-[0_0_15px_rgba(180,100,255,0.3)]"
        >
          UTWÓRZ POKÓJ
        </button>
      </div>
    </div>
  );
}

function AddToRoomDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const { addToRoom, onlineUsers } = useSocket();
  const currentUser = getUsername();
  const eligible = onlineUsers.filter(u => u.username !== currentUser && !room.members.includes(u.username));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-mono">DODAJ DO POKOJU</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-mono">#{room.name}</p>
        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Brak dostępnych użytkowników do dodania.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {eligible.map((user) => (
              <li key={user.socketId}>
                <button
                  onClick={() => { addToRoom(room.id, user.username); onClose(); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary border border-white/5 hover:border-white/10 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-mono font-bold text-primary text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium">{user.username}</span>
                  <Plus className="w-3.5 h-3.5 text-primary ml-auto" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeleteRoomDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const { deleteRoom } = useSocket();

  const handleDelete = () => {
    deleteRoom(room.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-mono">USUŃ POKÓJ</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-white/90">
            Czy na pewno chcesz usunąć pokój <span className="font-bold text-white">#{room.name}</span>?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ta operacja jest nieodwracalna. Wszystkie wiadomości zostaną usunięte.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-white/10 bg-secondary text-white/70 text-sm font-medium hover:text-white hover:bg-secondary/80 transition-all"
          >
            Anuluj
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold transition-all shadow-[0_0_12px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoomsTab({ onEnterRoom, onSetRoomDefault, defaultRoomId }: RoomsTabProps) {
  const { rooms, joinRoom, onlineUsers, isAdmin } = useSocket();
  const currentUser = getUsername();
  const [showCreate, setShowCreate] = useState(false);
  const [addToRoomTarget, setAddToRoomTarget] = useState<Room | null>(null);
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<Room | null>(null);

  const handleJoin = (room: Room) => {
    joinRoom(room.id);
    onEnterRoom(room.id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-white/5 flex items-center justify-center">
              <Hash className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">Brak pokojów. Utwórz pierwszy!</p>
          </div>
        ) : (
          rooms.map((room) => {
            const isMember = room.members.includes(currentUser || "");
            const isCreator = room.creator === currentUser;
            const canDelete = isCreator || isAdmin;
            const onlineCount = room.members.filter(m => onlineUsers.some(u => u.username === m)).length;

            return (
              <div key={room.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/40 border border-white/5 hover:bg-secondary/60 hover:border-white/10 transition-all">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/20 border border-primary/40">
                  {room.type === "private" ? (
                    <Lock className="w-5 h-5 text-white" />
                  ) : (
                    <Hash className="w-5 h-5 text-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-semibold text-sm truncate">{room.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 bg-primary/20 border border-primary/40 text-white">
                      {room.type === "private" ? "ZAMKNIĘTY" : "OTWARTY"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {room.members.length}
                    </span>
                    <span>•</span>
                    <span className="text-green-400/80">{onlineCount} online</span>
                    <span>•</span>
                    <span>{safeFormat(room.createdAt, "d.MM")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Add member — only creator of private rooms */}
                  {isCreator && room.type === "private" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddToRoomTarget(room); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-white text-[11px] font-mono font-semibold hover:bg-primary/30 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Dodaj
                    </button>
                  )}

                  {/* Enter / Join */}
                  {isMember ? (
                    <button
                      onClick={() => { joinRoom(room.id); onEnterRoom(room.id); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-white text-[11px] font-mono font-semibold hover:bg-primary/30 transition-colors"
                    >
                      Wejdź <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : room.type === "public" ? (
                    <button
                      onClick={() => handleJoin(room)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-white text-[11px] font-mono font-semibold hover:bg-primary/30 transition-colors"
                    >
                      Dołącz <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : null}

                  {/* Set as default */}
                  {onSetRoomDefault && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSetRoomDefault(room.id); }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-mono font-semibold transition-colors border ${defaultRoomId === room.id ? "bg-primary/30 border-primary/50 text-white" : "bg-primary/20 border-primary/40 text-white hover:bg-primary/30"}`}
                      title="Ustaw jako główny"
                    >
                      {defaultRoomId === room.id ? "GŁÓWNY ✓" : "GŁÓWNY"}
                    </button>
                  )}
                  {/* Delete — creator or admin */}
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteRoomTarget(room); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10 border border-destructive/20 text-red-400/70 hover:bg-destructive/20 hover:text-red-400 hover:border-destructive/40 transition-colors"
                      title="Usuń pokój"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full h-12 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Dodaj Pokój
        </button>
      </div>

      {showCreate && <CreateRoomDialog onClose={() => setShowCreate(false)} />}
      {addToRoomTarget && <AddToRoomDialog room={addToRoomTarget} onClose={() => setAddToRoomTarget(null)} />}
      {deleteRoomTarget && <DeleteRoomDialog room={deleteRoomTarget} onClose={() => setDeleteRoomTarget(null)} />}
    </div>
  );
}
