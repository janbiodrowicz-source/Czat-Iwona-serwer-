import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getToken, setToken, setUsername, setIsAdmin } from "@/lib/storage";
import { P5Background } from "@/components/p5-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type Mode = "login" | "register";

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (getToken()) setLocation("/chat");
  }, [setLocation]);

  const getDeviceId = (): string => {
    const stored = localStorage.getItem("device_id");
    if (stored) return stored;
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("device_id", id);
    return id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = username.trim();
    const pass = password;
    if (!name || !pass) return;

    if (mode === "register" && pass !== confirmPassword) {
      setError("Hasła nie są identyczne.");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const deviceId = getDeviceId();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pass, deviceId }),
      });
      const data = await res.json() as { token?: string; username?: string; isAdmin?: boolean; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Wystąpił błąd. Spróbuj ponownie.");
        return;
      }
      setToken(data.token);
      setUsername(data.username ?? name);
      if (data.isAdmin) setIsAdmin();
      window.location.href = "/chat";
    } catch {
      setError("Nie można połączyć się z serwerem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center bg-background overflow-hidden">
      <P5Background />
      <div className="relative z-10 w-full max-w-md p-6">
        <div className="text-center mb-10">
          <h1
            className="text-5xl font-sans font-bold tracking-tight mb-2"
            style={{ color: "#fff", textShadow: "0 0 12px rgba(180,100,255,0.9), 0 0 30px rgba(180,100,255,0.6), 0 0 60px rgba(180,100,255,0.3)" }}
          >
            Chat Iwona
          </h1>
          <p className="text-muted-foreground font-mono text-sm tracking-widest uppercase">
            BEZPIECZNY. SZYBKI. NIEZAWODNY.
          </p>
        </div>

        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 py-4 text-sm font-mono font-semibold tracking-wider transition-colors ${
                mode === "login" ? "text-white border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-white/70"
              }`}
            >
              ZALOGUJ SIĘ
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 py-4 text-sm font-mono font-semibold tracking-wider transition-colors ${
                mode === "register" ? "text-white border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-white/70"
              }`}
            >
              ZAREJESTRUJ SIĘ
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            <div className="space-y-3">
              <Input
                placeholder="Nazwa użytkownika..."
                value={username}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="h-14 bg-black/40 border-white/10 text-lg text-center font-mono placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary transition-all"
                autoFocus
                maxLength={30}
                disabled={isSubmitting}
                autoComplete="username"
              />
              <Input
                type="password"
                placeholder="Hasło..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 bg-black/40 border-white/10 text-lg text-center font-mono placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary transition-all"
                disabled={isSubmitting}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "register" && (
                <Input
                  type="password"
                  placeholder="Potwierdź hasło..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-14 bg-black/40 border-white/10 text-lg text-center font-mono placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary transition-all"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
              )}
              {error && (
                <p className="text-destructive text-sm text-center font-medium animate-in fade-in">
                  {error}
                </p>
              )}
            </div>

            {mode === "register" && (
              <p className="text-xs text-muted-foreground text-center font-mono">
                Min. 3 znaki w nazwie • Min. 6 znaków w haśle
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(180,100,255,0.4)] hover:shadow-[0_0_30px_rgba(180,100,255,0.6)] transition-all"
              disabled={!username.trim() || !password || (mode === "register" && !confirmPassword) || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : mode === "login" ? "ZALOGUJ SIĘ" : "UTWÓRZ KONTO"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
