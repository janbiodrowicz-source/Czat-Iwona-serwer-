import { Component, ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SocketProvider } from "@/lib/socket";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Chat from "@/pages/chat";
import Dm from "@/pages/dm";

const queryClient = new QueryClient();

interface EBState { error: Error | null; info: string }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, info: "" };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error, info: "" };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
    this.setState({ info: info.componentStack?.slice(0, 300) ?? "" });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0f", color: "#fff", gap: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ color: "#f87171", fontFamily: "monospace", fontSize: "15px", fontWeight: 700 }}>Błąd renderowania</p>
          <pre style={{ color: "#fbbf24", fontFamily: "monospace", fontSize: "12px", whiteSpace: "pre-wrap", maxWidth: "560px", textAlign: "left", background: "#111", padding: "12px", borderRadius: "8px", border: "1px solid #333" }}>
            {this.state.error.message}
          </pre>
          {this.state.info ? (
            <pre style={{ color: "#6b7280", fontFamily: "monospace", fontSize: "10px", whiteSpace: "pre-wrap", maxWidth: "560px", textAlign: "left" }}>
              {this.state.info}
            </pre>
          ) : null}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              onClick={() => this.setState({ error: null, info: "" })}
              style={{ padding: "10px 24px", background: "#9333ea", color: "#fff", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
            >
              Spróbuj ponownie
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 24px", background: "transparent", color: "#9ca3af", border: "1px solid #374151", borderRadius: "12px", fontSize: "14px", cursor: "pointer" }}
            >
              Przeładuj
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/chat" component={Chat} />
      <Route path="/dm/:username" component={Dm} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </SocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
