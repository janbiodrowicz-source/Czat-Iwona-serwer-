interface TypingIndicatorProps {
  usernames: string[];
  className?: string;
}

export function TypingIndicator({ usernames, className = "" }: TypingIndicatorProps) {
  if (!usernames.length) return null;

  const label =
    usernames.length === 1
      ? `${usernames[0]} pisze...`
      : usernames.length === 2
        ? `${usernames[0]} i ${usernames[1]} piszą...`
        : `${usernames[0]} i ${usernames.length - 1} innych pisze...`;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground font-mono ${className}`}>
      <span className="flex gap-0.5 items-end">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      <span>{label}</span>
    </div>
  );
}
