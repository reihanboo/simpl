import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronUp, Minus, Send, Sparkles } from 'lucide-react';
import { Markdown } from './Markdown';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const suggestedQuestions = [
  'Apa yang perlu saya pesan ulang?',
  'Ringkas penjualan hari ini',
  'Produk apa yang paling laris?',
];

export default function ABAIChatWidget({ branchId }: { branchId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [chatMessages, isChatSending, isOpen]);

  const sendChatMessage = async (message = chatInput.trim()) => {
    const content = message.trim();
    if (!content || isChatSending) return;

    const history = chatMessages.slice(-10);
    setChatMessages((messages) => [...messages, { role: 'user', content }]);
    setChatInput('');
    setIsChatSending(true);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${branchId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content, history }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'ABAI tidak dapat menjawab saat ini.');
      }

      const result = await res.json();
      setChatMessages((messages) => [...messages, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      const fallback = 'Maaf, ABAI sedang tidak dapat dihubungi. Coba lagi sebentar.';
      setChatMessages((messages) => [
        ...messages,
        { role: 'assistant', content: err instanceof Error ? err.message : fallback },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendChatMessage();
  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-2 z-70 flex flex-col items-end sm:right-5">
      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <motion.section
            key="abai-chat-panel"
            initial={{ opacity: 0, y: 64, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
            aria-label="Chat ABAI"
            className="pointer-events-auto flex h-[min(38rem,calc(100dvh-0.75rem))] w-[min(23rem,calc(100vw-1rem))] origin-bottom-right flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#21AC3A] text-white">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">ABAI assistant</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Asisten operasional AI · Aktif</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimalkan chat"
                title="Minimalkan"
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Minus className="h-5 w-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                <div className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#21AC3A] text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 bg-slate-100 p-3 text-xs leading-5 text-slate-700">
                    <p className="mb-1 font-semibold text-slate-800">ABAI</p>
                    <p>Halo! Saya siap membantu menganalisis penjualan, stok, dan operasional cabang Anda.</p>
                  </div>
                </div>
                {chatMessages.map((message, index) => (
                  <div key={`${index}-${message.role}`} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'assistant' && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#21AC3A] text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className={`max-w-[85%] p-3 text-xs leading-5 ${message.role === 'user' ? 'bg-[#21AC3A] text-white' : 'min-w-0 flex-1 bg-slate-100 text-slate-700'}`}>
                      {message.role === 'user' ? message.content : <Markdown content={message.content} />}
                    </div>
                  </div>
                ))}
                {isChatSending && (
                  <div className="flex gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#21AC3A] text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 bg-slate-100 p-3 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 animate-pulse bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-pulse bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-pulse bg-slate-400" />
                      <span className="ml-1">ABAI sedang menyiapkan jawaban...</span>
                    </div>
                  </div>
                )}

              </div>

              {chatMessages.length === 0 && (
                <div className="shrink-0 px-4 pb-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Pertanyaan yang disarankan</p>
                  <div className="space-y-1.5">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void sendChatMessage(question)}
                        className="flex w-full items-center justify-between gap-2 border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-[#21AC3A] hover:bg-[#21AC3A]/5"
                      >
                        <span>{question}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#21AC3A]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="m-3 flex shrink-0 items-center gap-2 border border-slate-300 px-3 py-2 focus-within:border-[#21AC3A]">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  aria-label="Tanya ABAI"
                  placeholder="Tanya ABAI tentang bisnis Anda..."
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  aria-label="Kirim pesan"
                  disabled={!chatInput.trim() || isChatSending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#21AC3A] text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
              <p className="shrink-0 px-3 pb-3 text-center text-[10px] leading-4 text-slate-400">
                Ditenagai DeepSeek · Verifikasi jawaban ABAI sebelum mengambil keputusan.
              </p>
            </div>
          </motion.section>
        ) : (
          <motion.button
            key="abai-chat-tab"
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => setIsOpen(true)}
            aria-label="Buka chat ABAI"
            aria-expanded={false}
            className="pointer-events-auto flex h-14 w-[min(18rem,calc(100vw-1rem))] items-center gap-3 border border-b-0 border-slate-300 border-t-2 border-t-[#21AC3A] bg-white px-3 text-left shadow-[0_-3px_14px_rgba(15,23,42,0.12)] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#21AC3A]"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center bg-[#21AC3A] text-white">
              <Sparkles className="h-4 w-4" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 border-2 border-white bg-emerald-500" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">ABAI assistant</span>
              <span className="block text-[11px] text-slate-500">Asisten operasional · Aktif</span>
            </span>
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
