import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getToken, getUsername, setUsername, clearAll, setIsAdmin } from "@/lib/storage";

export const ADMIN_USERNAME = "Jasko4185";

export interface Room {
  id: string;
  name: string;
  creator: string;
  type: "public" | "private";
  members: string[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  imageUrl?: string;
  reactions?: Record<string, string[]>;
}

export interface DmMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
  imageUrl?: string;
  reactions?: Record<string, string[]>;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  username: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  reactions?: Record<string, string[]>;
}

export interface OnlineUser {
  username: string;
  socketId: string;
  joinedAt: string;
}

export interface IncomingCall {
  from: string;
  callType: "video" | "audio";
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  isAdmin: boolean;
  joinError: string | null;
  mutedUsernames: Set<string>;
  bannedUsernames: Set<string>;
  kickUser: (username: string) => void;
  banUser: (username: string) => void;
  muteUser: (username: string) => void;
  sendMessage: (text: string) => void;
  sendImage: (imageUrl: string, text?: string) => void;
  sendDm: (to: string, text: string) => void;
  sendDmImage: (to: string, imageUrl: string, text?: string) => void;
  logout: () => void;
  dmMessages: Map<string, DmMessage[]>;
  unreadDmCounts: Map<string, number>;
  clearUnread: (username: string) => void;
  currentDmPartner: string | null;
  setCurrentDmPartner: (username: string | null) => void;
  rooms: Room[];
  roomMessages: Map<string, RoomMessage[]>;
  createRoom: (name: string, type: "public" | "private") => void;
  deleteRoom: (roomId: string) => void;
  joinRoom: (roomId: string) => void;
  addToRoom: (roomId: string, username: string) => void;
  sendRoomMessage: (roomId: string, text: string, imageUrl?: string) => void;
  getDmHistory: (partner: string) => void;
  incomingCall: IncomingCall | null;
  dismissIncomingCall: () => void;
  botsEnabled: boolean;
  roomInvite: {from: string; roomId: string; roomName: string} | null;
  setRoomInvite: (v: null) => void;
  testReport: {name: string; ok: boolean; time: number}[];
  startBots: () => void;
  stopBots: () => void;
  requestCall: (to: string, callType?: "video" | "audio") => void;
  acceptCall: (to: string) => void;
  rejectCall: (to: string) => void;
  endCall: (to: string) => void;
  sendOffer: (to: string, offer: RTCSessionDescriptionInit) => void;
  sendAnswer: (to: string, answer: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (to: string, candidate: RTCIceCandidateInit) => void;
  startTyping: (context: string) => void;
  stopTyping: (context: string) => void;
  typingUsers: Map<string, string[]>;
  addReaction: (messageId: string, messageType: "global" | "room" | "dm", emoji: string) => void;
  reactionUpdates: Map<string, Record<string, string[]>>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAdmin, setIsAdminState] = useState(false);
  const [mutedUsernames, setMutedUsernames] = useState<Set<string>>(new Set());
  const [bannedUsernames, setBannedUsernames] = useState<Set<string>>(new Set());
  const [dmMessages, setDmMessages] = useState<Map<string, DmMessage[]>>(new Map());
  const [unreadDmCounts, setUnreadDmCounts] = useState<Map<string, number>>(new Map());
  const [currentDmPartner, setCurrentDmPartner] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomMessages, setRoomMessages] = useState<Map<string, RoomMessage[]>>(new Map());
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [botsEnabled, setBotsEnabled] = useState(false);
  const [testReport, setTestReport] = useState<{name: string; ok: boolean; time: number}[]>([]);
  const [roomInvite, setRoomInvite] = useState<{from: string; roomId: string; roomName: string} | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const [reactionUpdates, setReactionUpdates] = useState<Map<string, Record<string, string[]>>>(new Map());

  const currentDmPartnerRef = useRef<string | null>(null);
  useEffect(() => { currentDmPartnerRef.current = currentDmPartner; }, [currentDmPartner]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const newSocket = io({ path: "/api/socket.io", auth: { token } });
    setSocket(newSocket);

    newSocket.on("connect", () => setIsConnected(true));
    newSocket.on("disconnect", () => setIsConnected(false));

    newSocket.on("connect_error", (err) => {
      setJoinError(err.message);
    });

    newSocket.on("online_users", (users: OnlineUser[]) => setOnlineUsers(users));

    newSocket.on("join_success", (user: { username: string; isAdmin: boolean; isMuted?: boolean }) => {
      setUsername(user.username);
      if (user.isAdmin) { setIsAdminState(true); setIsAdmin(); }
      setJoinError(null);
      // Register push notifications after successful connection
      import("./push").then(({ registerPushNotifications }) => {
        const token = getToken();
        if (token) registerPushNotifications(token).catch(() => {});
      }).catch(() => {});
    });

    newSocket.on("admin_state", (state: { mutedUsers: string[]; bannedUsers: string[] }) => {
      setMutedUsernames(new Set(state.mutedUsers));
      setBannedUsernames(new Set(state.bannedUsers));
    });

    newSocket.on("mute_toggled", ({ username, muted }: { username: string; muted: boolean }) => {
      setMutedUsernames((prev) => {
        const next = new Set(prev);
        if (muted) next.add(username); else next.delete(username);
        return next;
      });
    });

    newSocket.on("unban_confirmed", (username: string) => {
      setBannedUsernames((prev) => { const next = new Set(prev); next.delete(username); return next; });
    });

    newSocket.on("kicked", (msg: string) => { alert(msg); clearAll(); window.location.href = "/"; });
    newSocket.on("banned", (msg: string) => { alert(msg); clearAll(); window.location.href = "/"; });
    newSocket.on("you_muted", (msg: string) => alert(msg));
    newSocket.on("you_unmuted", (msg: string) => alert(msg));

    newSocket.on("new_dm", (msg: DmMessage) => {
      const currentUser = getUsername();
      if (!currentUser) return;
      const other = msg.from === currentUser ? msg.to : msg.from;
      setDmMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(other, [...(newMap.get(other) || []), msg]);
        return newMap;
      });
      if (msg.from !== currentUser && currentDmPartnerRef.current !== msg.from) {
        setUnreadDmCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(msg.from, (newMap.get(msg.from) || 0) + 1);
          return newMap;
        });
      }
    });

    newSocket.on("dm_history", ({ partner, messages }: { partner: string; messages: DmMessage[] }) => {
      setDmMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(partner, messages);
        return newMap;
      });
    });

    newSocket.on("rooms_list", (updatedRooms: Room[]) => setRooms(updatedRooms));

    newSocket.on("room_deleted", ({ roomId }: { roomId: string }) => {
      setRoomMessages((prev) => { const m = new Map(prev); m.delete(roomId); return m; });
    });

    newSocket.on("room_history", ({ roomId, messages }: { roomId: string; messages: RoomMessage[] }) => {
      setRoomMessages((prev) => { const m = new Map(prev); m.set(roomId, messages); return m; });
    });

    newSocket.on("new_room_message", (msg: RoomMessage) => {
      setRoomMessages((prev) => {
        const m = new Map(prev);
        m.set(msg.roomId, [...(m.get(msg.roomId) || []), msg]);
        return m;
      });
    });

    newSocket.on("call_request", ({ from, callType }: { from: string; callType?: "video" | "audio" }) => setIncomingCall({ from, callType: callType ?? "video" }));

    newSocket.on("typing_start", ({ username, context }: { username: string; context: string }) => {
      setTypingUsers((prev) => {
        const m = new Map(prev);
        const cur = m.get(context) || [];
        if (!cur.includes(username)) m.set(context, [...cur, username]);
        return m;
      });
    });

    newSocket.on("typing_stop", ({ username, context }: { username: string; context: string }) => {
      setTypingUsers((prev) => {
        const m = new Map(prev);
        m.set(context, (m.get(context) || []).filter((u) => u !== username));
        return m;
      });
    });

    newSocket.on("reaction_updated", ({ messageId, reactions }: { messageId: string; messageType: string; reactions: Record<string, string[]> }) => {
      setReactionUpdates((prev) => {
        const m = new Map(prev);
        m.set(messageId, reactions);
        return m;
      });
    });

    return () => { newSocket.disconnect(); };
  }, []);

  const kickUser = useCallback((u: string) => { socket?.emit("kick_user", u); }, [socket]);
  const banUser = useCallback((u: string) => { socket?.emit("ban_user", u); }, [socket]);
  const muteUser = useCallback((u: string) => { socket?.emit("mute_user", u); }, [socket]);
  const sendMessage = useCallback((text: string) => { socket?.emit("send_message", text); }, [socket]);
  const sendImage = useCallback((imageUrl: string, text?: string) => { socket?.emit("send_image", { imageUrl, text }); }, [socket]);
  const sendDm = useCallback((to: string, text: string) => { socket?.emit("send_dm", { to, text }); }, [socket]);
  const sendDmImage = useCallback((to: string, imageUrl: string, text?: string) => { socket?.emit("send_dm_image", { to, imageUrl, text }); }, [socket]);
  const clearUnread = useCallback((u: string) => {
    setUnreadDmCounts((prev) => { if (!prev.has(u) || prev.get(u) === 0) return prev; const m = new Map(prev); m.set(u, 0); return m; });
  }, []);
  const logout = useCallback(async () => {
    const token = getToken();
    if (token) await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    clearAll();
    socket?.disconnect();
    window.location.href = "/";
  }, [socket]);
  const createRoom = useCallback((name: string, type: "public" | "private") => { socket?.emit("create_room", { name, type }); }, [socket]);
  const deleteRoom = useCallback((roomId: string) => { socket?.emit("delete_room", roomId); }, [socket]);
  const joinRoom = useCallback((roomId: string) => { socket?.emit("join_room", roomId); }, [socket]);
  const addToRoom = useCallback((roomId: string, username: string) => { socket?.emit("add_to_room", { roomId, username }); }, [socket]);
  const sendRoomMessage = useCallback((roomId: string, text: string, imageUrl?: string) => { socket?.emit("send_room_message", { roomId, text, imageUrl }); }, [socket]);
  const getDmHistory = useCallback((partner: string) => { socket?.emit("get_dm_history", { partner }); }, [socket]);
  const dismissIncomingCall = useCallback(() => setIncomingCall(null), []);
  const requestCall = useCallback((to: string, callType: "video" | "audio" = "video") => { socket?.emit("call_request", { to, callType }); }, [socket]);
  const acceptCall = useCallback((to: string) => { socket?.emit("call_accept", { to }); }, [socket]);
  const rejectCall = useCallback((to: string) => { socket?.emit("call_reject", { to }); setIncomingCall(null); }, [socket]);
  const endCall = useCallback((to: string) => { socket?.emit("call_end", { to }); }, [socket]);
  const sendOffer = useCallback((to: string, offer: RTCSessionDescriptionInit) => { socket?.emit("webrtc_offer", { to, offer }); }, [socket]);
  const sendAnswer = useCallback((to: string, answer: RTCSessionDescriptionInit) => { socket?.emit("webrtc_answer", { to, answer }); }, [socket]);
  const sendIceCandidate = useCallback((to: string, candidate: RTCIceCandidateInit) => { socket?.emit("webrtc_ice_candidate", { to, candidate }); }, [socket]);

  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const startTyping = useCallback((context: string) => {
    if (!socket) return;
    socket.emit("typing_start", { context });
    const key = context;
    if (typingTimers.current.has(key)) clearTimeout(typingTimers.current.get(key)!);
    typingTimers.current.set(key, setTimeout(() => {
      socket.emit("typing_stop", { context });
      typingTimers.current.delete(key);
    }, 3000));
  }, [socket]);

  const stopTyping = useCallback((context: string) => {
    if (!socket) return;
    const key = context;
    if (typingTimers.current.has(key)) { clearTimeout(typingTimers.current.get(key)!); typingTimers.current.delete(key); }
    socket.emit("typing_stop", { context });
  }, [socket]);

  const addReaction = useCallback((messageId: string, messageType: "global" | "room" | "dm", emoji: string) => {
    socket?.emit("add_reaction", { messageId, messageType, emoji });
  }, [socket]);

  return (
    <SocketContext.Provider value={{
      socket, isConnected, onlineUsers, isAdmin, joinError,
      mutedUsernames, bannedUsernames,
      kickUser, banUser, muteUser,
      sendMessage, sendImage, sendDm, sendDmImage, logout,
      dmMessages, unreadDmCounts, clearUnread,
      currentDmPartner, setCurrentDmPartner,
      rooms, roomMessages, createRoom, deleteRoom, joinRoom, addToRoom, sendRoomMessage,
      getDmHistory,
      incomingCall, dismissIncomingCall,
      requestCall, acceptCall, rejectCall, endCall,
      sendOffer, sendAnswer, sendIceCandidate,
      startTyping, stopTyping, typingUsers,
      addReaction, reactionUpdates,
    }}>
      {children}
    </SocketContext.Provider>
  );
}
