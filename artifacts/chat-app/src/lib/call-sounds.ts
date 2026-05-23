let ctx: AudioContext | null = null;
let ringingInterval: ReturnType<typeof setInterval> | null = null;

const getCtx = () => {
  if (!ctx) ctx = new AudioContext();
  return ctx;
};

const beep = (freq: number, duration: number, vol = 0.3, type: OscillatorType = "sine") => {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
};

export const playRinging = () => {
  stopRinging();
  const ring = () => { beep(440, 0.4, 0.3); setTimeout(() => beep(480, 0.4, 0.3), 200); };
  ring();
  ringingInterval = setInterval(ring, 3000);
};

export const stopRinging = () => {
  if (ringingInterval) { clearInterval(ringingInterval); ringingInterval = null; }
};

export const playCallAccepted = () => {
  beep(600, 0.15, 0.3);
  setTimeout(() => beep(800, 0.2, 0.3), 150);
};

export const playCallBusy = () => {
  const busy = () => beep(480, 0.5, 0.3, "square");
  busy(); setTimeout(busy, 600); setTimeout(busy, 1200);
};

export const playCallOffline = () => {
  beep(300, 0.8, 0.3, "sawtooth");
};

export const playCallEnded = () => {
  beep(400, 0.3, 0.2);
  setTimeout(() => beep(300, 0.4, 0.2), 200);
};
