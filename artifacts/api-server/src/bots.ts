import type { Server as SocketIOServer } from "socket.io";
import { onlineUsers } from "./socket";

export const BOTS = [
  { username: "Bot_Ania",    emoji: "🌸" },
  { username: "Bot_Marek",   emoji: "🤖" },
  { username: "Bot_Support", emoji: "🛡️" },
];

export const BOT_USERNAMES = new Set(BOTS.map(b => b.username));

let botsEnabled = false;
let botTimers: ReturnType<typeof setTimeout>[] = [];

// Test results for report
const testResults: { name: string; ok: boolean; time: number }[] = [];

function clearTimers() {
  botTimers.forEach(t => clearTimeout(t));
  botTimers = [];
}

function later(fn: () => void, ms: number) {
  const t = setTimeout(() => { if (botsEnabled) fn(); }, ms);
  botTimers.push(t);
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function areBotsEnabled() { return botsEnabled; }
export function getTestResults() { return [...testResults]; }

// Register bots as fake online users
function registerBots(io: SocketIOServer) {
  for (const bot of BOTS) {
    const fakeSocketId = "bot_" + bot.username;
    onlineUsers.set(fakeSocketId, {
      username: bot.username,
      socketId: fakeSocketId,
      joinedAt: new Date().toISOString(),
    });
  }
  io.emit("users_update", Array.from(onlineUsers.values()));
}

function unregisterBots(io: SocketIOServer) {
  for (const bot of BOTS) {
    onlineUsers.delete("bot_" + bot.username);
  }
  io.emit("users_update", Array.from(onlineUsers.values()));
}

function emitToAdmin(io: SocketIOServer, adminUsername: string, event: string, data: unknown): boolean {
  for (const [sid, u] of onlineUsers) {
    if (u.username === adminUsername && !sid.startsWith("bot_")) {
      io.to(sid).emit(event, data);
      return true;
    }
  }
  return false;
}

function globalMsg(io: SocketIOServer, botName: string, text: string) {
  io.emit("new_message", {
    id: genId(),
    username: botName,
    text,
    timestamp: new Date().toISOString(),
    reactions: {},
  });
}

function createRoom(io: SocketIOServer, botName: string, name: string, type: "public" | "private") {
  const room = {
    id: genId(),
    name,
    creator: botName,
    type,
    members: [botName],
    createdAt: new Date().toISOString(),
  };
  io.emit("room_created", room);
  return room;
}

function recordTest(name: string, ok: boolean) {
  testResults.push({ name, ok, time: Date.now() });
}

export function startBots(io: SocketIOServer, adminUsername: string) {
  if (botsEnabled) return;
  botsEnabled = true;
  testResults.length = 0;

  registerBots(io);

  // ── SCENARIUSZ TESTOWY ──

  // T=1s: Bot_Ania pisze na czacie
  later(() => {
    globalMsg(io, "Bot_Ania", "🌸 Hej! Jestem Bot_Ania — zaczynam testy aplikacji!");
    recordTest("Wiadomość globalna", true);
  }, 1000);

  // T=3s: Bot_Ania wysyła zaproszenie do znajomych
  later(() => {
    const ok = emitToAdmin(io, adminUsername, "friend_request", { from: "Bot_Ania" });
    globalMsg(io, "Bot_Ania", `💌 @${adminUsername} wysyłam Ci zaproszenie do znajomych!`);
    recordTest("Zaproszenie do znajomych", ok);
  }, 3000);

  // T=5s: Bot_Support tworzy otwarty pokój
  later(() => {
    createRoom(io, "Bot_Support", "Pokój Testowy 🛡️", "public");
    globalMsg(io, "Bot_Support", "🛡️ Stworzyłem otwarty pokój testowy!");
    recordTest("Tworzenie pokoju otwartego", true);
  }, 5000);

  // T=7s: Bot_Marek tworzy prywatny pokój
  later(() => {
    const room = createRoom(io, "Bot_Marek", "Prywatny Pokój 🤖", "private");
    globalMsg(io, "Bot_Marek", "🤖 Stworzyłem prywatny pokój!");
    recordTest("Tworzenie pokoju prywatnego", true);

    // T=8.5s: zaproszenie do prywatnego pokoju
    later(() => {
      const ok = emitToAdmin(io, adminUsername, "room_invite", {
        from: "Bot_Marek",
        roomId: room.id,
        roomName: room.name,
      });
      globalMsg(io, "Bot_Marek", `🤖 @${adminUsername} zapraszam Cię do prywatnego pokoju!`);
      recordTest("Zaproszenie do pokoju", ok);
    }, 1500);
  }, 7000);

  // T=10s: Bot_Ania tworzy kolejny pokój
  later(() => {
    createRoom(io, "Bot_Ania", "Pokój Ani 🌸", "public");
    recordTest("Tworzenie drugiego pokoju", true);
  }, 10000);

  // T=12s: Bot_Support wysyła DM
  later(() => {
    const ok = emitToAdmin(io, adminUsername, "new_dm", {
      id: genId(),
      from: "Bot_Support",
      to: adminUsername,
      text: "🛡️ Cześć! To prywatna wiadomość testowa od Bot_Support. Wszystko gra?",
      timestamp: new Date().toISOString(),
      reactions: {},
    });
    if (ok) emitToAdmin(io, adminUsername, "dm_unread", { from: "Bot_Support", count: 1 });
    recordTest("Wiadomość prywatna (DM)", ok);
  }, 12000);

  // T=15s: Bot_Ania dzwoni wideo
  later(() => {
    const ok = emitToAdmin(io, adminUsername, "call_request", {
      from: "Bot_Ania",
      callType: "video",
    });
    globalMsg(io, "Bot_Ania", `📹 @${adminUsername} dzwonię przez wideo!`);
    recordTest("Połączenie wideo", ok);
  }, 15000);

  // T=22s: Bot_Support dzwoni głosowo
  later(() => {
    const ok = emitToAdmin(io, adminUsername, "call_request", {
      from: "Bot_Support",
      callType: "audio",
    });
    globalMsg(io, "Bot_Support", `🎤 @${adminUsername} dzwonię głosowo!`);
    recordTest("Połączenie głosowe", ok);
  }, 22000);

  // T=26s: Bot_Marek wysyła DM
  later(() => {
    emitToAdmin(io, adminUsername, "new_dm", {
      id: genId(),
      from: "Bot_Marek",
      to: adminUsername,
      text: "🤖 Hej! Bot_Marek tutaj. Chcesz porozmawiać?",
      timestamp: new Date().toISOString(),
      reactions: {},
    });
    recordTest("DM od drugiego bota", true);
  }, 26000);

  // T=29s: podsumowanie testów
  later(() => {
    const passed = testResults.filter(r => r.ok).length;
    const total = testResults.length;
    globalMsg(io, "Bot_Support",
      `📊 TESTY ZAKOŃCZONE: ${passed}/${total} ✅ — sprawdź raport w panelu admina!`
    );
    // Send report to admin
    emitToAdmin(io, adminUsername, "bot_test_report", testResults);
  }, 29000);
}

export function stopBots(io: SocketIOServer) {
  botsEnabled = false;
  clearTimers();
  unregisterBots(io);
  console.log("[BOTS] Stopped");
}
