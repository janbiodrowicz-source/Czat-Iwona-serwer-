import { useEffect, useState } from 'react';

const initialBots = [
  { id: 1, name: 'Anna', status: 'online', action: 'wysyła wiadomość' },
  { id: 2, name: 'SupportBot', status: 'online', action: 'wysyła zaproszenie' },
  { id: 3, name: 'Tester', status: 'online', action: 'rozpoczyna połączenie wideo' },
];

export function TestBotPanel() {
  const [bots, setBots] = useState(initialBots);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const actions = [
      'wysłał wiadomość',
      'utworzył pokój',
      'rozpoczął rozmowę głosową',
      'rozpoczął rozmowę wideo',
      'wysłał zaproszenie do znajomych',
    ];

    const interval = setInterval(() => {
      const bot = bots[Math.floor(Math.random() * bots.length)];
      if (!bot) return;

      const action = actions[Math.floor(Math.random() * actions.length)];
      setLogs((prev) => [
        `${bot.name} ${action}`,
        ...prev.slice(0, 7),
      ]);
    }, 4000);

    return () => clearInterval(interval);
  }, [bots]);

  const removeBots = () => {
    setBots([]);
    setLogs(['Wszystkie boty testowe zostały usunięte']);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Panel Botów Testowych</h1>
            <p className="text-gray-400 mt-2">
              Symulacja wiadomości, pokoi i połączeń audio/video
            </p>
          </div>

          <button
            onClick={removeBots}
            className="bg-red-600 hover:bg-red-700 px-5 py-3 rounded-2xl font-semibold"
          >
            Usuń boty testowe
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">{bot.name}</h2>
                <span className="text-green-400 text-sm">{bot.status}</span>
              </div>

              <p className="text-zinc-400">{bot.action}</p>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <h3 className="text-xl font-semibold mb-4">Aktywność botów</h3>

          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={index}
                className="bg-zinc-800 rounded-xl px-4 py-3 text-sm"
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TestBotPanel;
