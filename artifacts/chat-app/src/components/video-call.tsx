import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/lib/socket";
import { MicOff, Mic, VideoOff, Video, PhoneOff, Phone, X } from "lucide-react";
import { playRinging, stopRinging, playCallAccepted, playCallEnded } from "@/lib/call-sounds";

type CallState = "calling" | "incoming" | "connected" | "ended";

export interface VideoCallProps {
  partnerUsername: string;
  initialState: "calling" | "incoming";
  callType: "video" | "audio";
  onClose: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function VideoCall({ partnerUsername, initialState, callType, onClose }: VideoCallProps) {
  const {
    socket, requestCall, acceptCall, rejectCall, endCall,
    sendOffer, sendAnswer, sendIceCandidate, dismissIncomingCall,
  } = useSocket();

  const [callState, setCallState] = useState<CallState>(initialState);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isMountedRef = useRef(true);
  const hangupCalledRef = useRef(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Call timer
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      playCallAccepted();
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (callState === "ended") playCallEnded();
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [callState]);

  // Ringing sound when calling
  useEffect(() => {
    if (callState === "calling" && initialState === "calling") playRinging();
    else stopRinging();
    return () => stopRinging();
  }, [callState, initialState]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { remoteAudioRef.current.remove(); } catch {}
      remoteAudioRef.current = null;
    }
  }, []);

  // Keep hangup in a ref so createPeerConnection never has stale closure
  const hangupRef = useRef<() => void>(() => {});

  const handleHangup = useCallback(() => {
    if (hangupCalledRef.current) return;
    hangupCalledRef.current = true;
    if (isMountedRef.current) setCallState("ended");
    endCall(partnerUsername);
    cleanup();
    setTimeout(() => { if (isMountedRef.current) onClose(); }, 600);
  }, [endCall, partnerUsername, cleanup, onClose]);

  useEffect(() => { hangupRef.current = handleHangup; }, [handleHangup]);

  const getLocalMedia = useCallback(async () => {
    const constraints = callType === "audio"
      ? { audio: true, video: false }
      : { video: true, audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (callType === "video" && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, [callType]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) sendIceCandidate(partnerUsername, e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      if (!e.streams[0]) return;
      if (callType === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      } else if (callType === "audio") {
        if (!remoteAudioRef.current) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          document.body.appendChild(audio);
          remoteAudioRef.current = audio;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (!isMountedRef.current) return;
      if (pc.connectionState === "connected") setCallState("connected");
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        hangupRef.current(); // always calls the latest handleHangup — no stale closure
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [partnerUsername, sendIceCandidate, callType]);

  // Initiate call on mount if caller
  useEffect(() => {
    if (initialState !== "calling") return;
    let cancelled = false;
    (async () => {
      try {
        await getLocalMedia();
        if (cancelled || !isMountedRef.current) return;
        requestCall(partnerUsername, callType);
      } catch {
        if (isMountedRef.current) {
          setError(callType === "audio" ? "Brak dostępu do mikrofonu." : "Brak dostępu do kamery lub mikrofonu.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;

    const onCallAccept = async () => {
      try {
        const pc = createPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendOffer(partnerUsername, offer);
      } catch {
        if (isMountedRef.current) setError("Błąd podczas nawiązywania połączenia.");
      }
    };

    const onCallReject = () => {
      if (isMountedRef.current) setCallState("ended");
      cleanup();
      setTimeout(() => { if (isMountedRef.current) onClose(); }, 600);
    };

    const onCallEnd = () => {
      if (isMountedRef.current) setCallState("ended");
      cleanup();
      setTimeout(() => { if (isMountedRef.current) onClose(); }, 600);
    };

    const onOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      try {
        let pc = pcRef.current;
        if (!pc) pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendAnswer(partnerUsername, answer);
        if (isMountedRef.current) setCallState("connected");
      } catch {
        if (isMountedRef.current) setError("Błąd podczas odbierania połączenia.");
      }
    };

    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        if (isMountedRef.current) setCallState("connected");
      } catch {
        if (isMountedRef.current) setError("Błąd odpowiedzi WebRTC.");
      }
    };

    const onIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) { pendingCandidatesRef.current.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    socket.on("call_accept", onCallAccept);
    socket.on("call_reject", onCallReject);
    socket.on("call_end", onCallEnd);
    socket.on("webrtc_offer", onOffer);
    socket.on("webrtc_answer", onAnswer);
    socket.on("webrtc_ice_candidate", onIce);

    return () => {
      socket.off("call_accept", onCallAccept);
      socket.off("call_reject", onCallReject);
      socket.off("call_end", onCallEnd);
      socket.off("webrtc_offer", onOffer);
      socket.off("webrtc_answer", onAnswer);
      socket.off("webrtc_ice_candidate", onIce);
    };
  }, [socket, partnerUsername, createPeerConnection, sendOffer, sendAnswer, cleanup, onClose]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const handleAcceptIncoming = async () => {
    try {
      await getLocalMedia();
      dismissIncomingCall();
      acceptCall(partnerUsername);
      // Stay in "calling" (waiting) state — WebRTC offer from caller will move us to "connected"
      if (isMountedRef.current) setCallState("calling");
    } catch {
      if (isMountedRef.current) {
        setError(callType === "audio" ? "Brak dostępu do mikrofonu." : "Brak dostępu do kamery lub mikrofonu.");
      }
    }
  };

  const handleRejectIncoming = () => {
    rejectCall(partnerUsername);
    dismissIncomingCall();
    onClose();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
  };

  const toggleCamera = () => {
    if (callType === "audio" || !localStreamRef.current) return;
    const newOff = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !newOff; });
    setIsCameraOff(newOff);
  };

  const isAudio = callType === "audio";

  const stateLabel: Record<CallState, string> = {
    calling: isAudio ? "Dzwonię głosowo..." : "Dzwonię przez wideo...",
    incoming: `${partnerUsername} ${isAudio ? "dzwoni głosowo" : "dzwoni przez wideo"}`,
    connected: "Połączono",
    ended: "Zakończono",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-white font-bold text-lg">{partnerUsername}</p>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isAudio ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-primary/15 border-primary/30 text-primary"}`}>
              {isAudio ? "GŁOS" : "WIDEO"}
            </span>
          </div>
          <p className={`text-sm font-mono ${callState === "connected" ? "text-green-400" : callState === "ended" ? "text-red-400" : "text-white/60"}`}>
            {stateLabel[callState]}{callState === "connected" ? ` • ${formatDuration(callDuration)}` : ""}
          </p>
        </div>
        {callState !== "incoming" && (
          <button onClick={() => { cleanup(); onClose(); }} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mx-5 mb-3 px-4 py-2 bg-destructive/20 border border-destructive/40 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {isAudio ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className={`w-36 h-36 rounded-full flex items-center justify-center border-4 font-mono font-bold text-5xl transition-all duration-500 ${
            callState === "connected"
              ? "bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_50px_rgba(34,197,94,0.25)]"
              : callState === "ended"
              ? "bg-destructive/20 border-destructive/40 text-red-400"
              : "bg-primary/20 border-primary/40 text-primary"
          }`}>
            {partnerUsername.charAt(0).toUpperCase()}
          </div>
          {callState === "calling" && (
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
          {callState === "connected" && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-green-400/80 text-xs font-mono">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Aktywna rozmowa głosowa
              </div>
              <div className="text-green-400 text-lg font-mono font-bold">{formatDuration(callDuration)}</div>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-white/30 text-xs font-mono">
            <Phone className="w-3 h-3" /> Połączenie audio
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden rounded-2xl mx-3 bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className={`w-full h-full object-cover ${callState !== "connected" ? "hidden" : ""}`} />
          {callState !== "connected" && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-mono font-bold text-4xl text-primary">
                {partnerUsername.charAt(0).toUpperCase()}
              </div>
              {callState === "calling" && (
                <div className="flex gap-1.5 mt-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="absolute bottom-3 right-3 w-28 h-20 rounded-xl overflow-hidden border border-white/20 bg-black shadow-lg">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {isCameraOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <VideoOff className="w-6 h-6 text-white/50" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-5 py-6">
        {callState === "incoming" ? (
          <>
            <button onClick={handleRejectIncoming} className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all active:scale-95">
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button onClick={handleAcceptIncoming} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all active:scale-95">
              <Phone className="w-7 h-7 text-white" />
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${isMuted ? "bg-destructive/80 hover:bg-destructive" : "bg-white/15 hover:bg-white/25"}`}>
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>
            <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all active:scale-95">
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            {!isAudio && (
              <button onClick={toggleCamera} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${isCameraOff ? "bg-destructive/80 hover:bg-destructive" : "bg-white/15 hover:bg-white/25"}`}>
                {isCameraOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
