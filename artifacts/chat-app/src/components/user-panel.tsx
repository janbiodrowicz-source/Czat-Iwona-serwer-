import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatMessage, OnlineUser } from "@/lib/socket";
import { ShieldCheck, User, Images, Star, Download, X, Camera, Loader2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getAvatar, setAvatar } from "@/lib/storage";
import { FriendsTab } from "@/components/friends-tab";
import type { Friend, FriendRequest } from "@/components/friends-tab";

interface UserPanelProps {
  friends?: Friend[];
  sentRequests?: FriendRequest[];
  receivedRequests?: FriendRequest[];
  onAcceptFriend?: (from: string) => void;
  onRejectFriend?: (from: string) => void;
  onCancelFriendRequest?: (to: string) => void;
  onRemoveFriend?: (username: string) => void;
  open: boolean;
  onClose: () => void;
  username: string;
  isAdmin: boolean;
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
}

function GalleryImage({ imageUrl }: { imageUrl: string }) {
  const [lightbox, setLightbox] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = JSON.parse(localStorage.getItem("savedImages") || "[]") as string[];
    if (!existing.includes(imageUrl)) {
      existing.push(imageUrl);
      localStorage.setItem("savedImages", JSON.stringify(existing));
      toast({ title: "Zapisano!", description: "Zdjęcie zostało zapisane w galerii." });
    } else {
      toast({ title: "Już zapisano", description: "To zdjęcie jest już w galerii." });
    }
  };

  return (
    <>
      <div
        className="relative group aspect-square cursor-zoom-in rounded-xl overflow-hidden border border-white/5 bg-secondary"
        onClick={() => setLightbox(true)}
      >
        <img
          src={imageUrl}
          alt="zdjęcie"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
          <button onClick={handleDownload} className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors" title="Pobierz">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleSave} className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors" title="Zapisz">
            <Star className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors" onClick={() => setLightbox(false)}>
            <X className="w-5 h-5" />
          </button>
          <img src={imageUrl} alt="zdjęcie" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-6 flex gap-3">
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors">
              <Download className="w-4 h-4" /> Pobierz
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/80 text-white text-sm font-medium hover:bg-primary transition-colors">
              <Star className="w-4 h-4" /> Zapisz
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function UserPanel({ open, onClose, username, isAdmin, messages, onlineUsers, friends = [], sentRequests = [], receivedRequests = [], onAcceptFriend, onRejectFriend, onCancelFriendRequest, onRemoveFriend }: UserPanelProps) {
  const [tab, setTab] = useState<"profile" | "friends" | "gallery">("profile");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(getAvatar(username));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allImages = messages.filter((m) => m.imageUrl && m.imageUrl.trim() !== "");
  let savedImages: string[] = [];
  try { savedImages = JSON.parse(localStorage.getItem("savedImages") || "[]") as string[]; } catch {}
  const isOnline = onlineUsers.some(u => u.username === username);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      setAvatar(username, url);
      setAvatarUrl(url);
      toast({ title: "Zaktualizowano!", description: "Zdjęcie profilowe zostało zmienione." });
    } catch {
      toast({ title: "Błąd", description: "Nie udało się przesłać zdjęcia." });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="bg-card border-border border-l w-full sm:max-w-sm p-0 flex flex-col overflow-hidden">

        {/* Profile header */}
        <SheetHeader className="p-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            {/* Avatar with upload */}
            <div className="relative shrink-0">
              <div
                className={`w-16 h-16 rounded-full overflow-hidden cursor-pointer group
                  ${isOnline ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={username}
                    className={`w-full h-full object-cover transition-all ${isOnline ? "" : "grayscale brightness-50"} group-hover:brightness-75`}
                  />
                ) : (
                  <div className={`w-full h-full bg-primary/20 border-2 ${isOnline ? "border-primary/60" : "border-white/10"} flex items-center justify-center font-mono font-bold text-2xl text-primary group-hover:bg-primary/30 transition-colors`}>
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-full transition-colors flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin opacity-0 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
              <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <SheetTitle className="text-white font-bold text-lg leading-none truncate">{username}</SheetTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                {isAdmin ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] font-mono font-bold">
                    <ShieldCheck className="w-3 h-3" /> ADMINISTRATOR
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-white/10 text-muted-foreground text-[10px] font-mono">
                    <User className="w-3 h-3" /> UŻYTKOWNIK
                  </span>
                )}
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono ${isOnline ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-[11px] text-primary/70 hover:text-primary font-mono transition-colors text-left flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                {uploadingAvatar ? "Wysyłanie..." : "Dodaj Zdjęcie Profilowe"}
              </button>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          <button
            className={`flex-1 py-3 text-xs font-mono font-semibold tracking-wider transition-colors ${tab === "profile" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
            onClick={() => setTab("profile")}
          >
            PROFIL
          </button>
          <button
            className={`flex-1 py-3 text-xs font-mono font-semibold tracking-wider transition-colors flex items-center justify-center gap-1.5 ${tab === "friends" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
            onClick={() => setTab("friends")}
          >
            <Users className="w-3.5 h-3.5" />
            ZNAJOMI
            {(receivedRequests.length) > 0 && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">{receivedRequests.length}</span>
            )}
          </button>
          <button
            className={`flex-1 py-3 text-xs font-mono font-semibold tracking-wider transition-colors flex items-center justify-center gap-1.5 ${tab === "gallery" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
            onClick={() => setTab("gallery")}
          >
            <Images className="w-3.5 h-3.5" />
            GALERIA
            {allImages.length > 0 && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{allImages.length}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "friends" && (
            <FriendsTab
              currentUser={username}
              friends={friends}
              sentRequests={sentRequests}
              receivedRequests={receivedRequests}
              onAccept={onAcceptFriend || (() => {})}
              onReject={onRejectFriend || (() => {})}
              onCancelRequest={onCancelFriendRequest}
              onRemoveFriend={onRemoveFriend}
            />
          )}
          {tab === "profile" && (
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-secondary/50 border border-white/5 p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-mono text-xs">PSEUDONIM</span>
                  <span className="text-white font-medium">{username}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-mono text-xs">ROLA</span>
                  <span className={`font-medium ${isAdmin ? "text-primary" : "text-white"}`}>{isAdmin ? "Administrator" : "Użytkownik"}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-mono text-xs">STATUS</span>
                  <span className={`font-medium ${isOnline ? "text-green-400" : "text-muted-foreground"}`}>{isOnline ? "Online" : "Offline"}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-mono text-xs">ZDJĘCIA W CZACIE</span>
                  <span className="text-white font-medium">{allImages.length}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-mono text-xs">ZAPISANE</span>
                  <span className="text-white font-medium">{savedImages.length}</span>
                </div>
              </div>

              {allImages.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground mb-3">OSTATNIE ZDJĘCIA</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {allImages.slice(-6).map((m, i) => (
                      <GalleryImage key={i} imageUrl={m.imageUrl as string} />
                    ))}
                  </div>
                  {allImages.length > 6 && (
                    <button className="mt-3 w-full py-2 text-xs font-mono text-primary hover:text-primary/80 transition-colors" onClick={() => setTab("gallery")}>
                      Zobacz wszystkie ({allImages.length}) →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "gallery" && (
            <div className="p-4">
              {allImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Images className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">Brak zdjęć w czacie</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-mono text-muted-foreground mb-3">WSZYSTKIE ZDJĘCIA ({allImages.length})</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {allImages.map((m, i) => (
                      <GalleryImage key={i} imageUrl={m.imageUrl as string} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
