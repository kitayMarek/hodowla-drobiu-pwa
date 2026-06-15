import { useState, useEffect } from 'react';

/**
 * Widget „Zapytaj LLM" — pole z gotowym pytaniem + przyciski Claude / Perplexity / ChatGPT.
 * Buduje prompt, który: (1) wskazuje pełną dokumentację online (contextUrl) dla modeli, które
 * potrafią ją pobrać, oraz (2) wkleja zwięzłe streszczenie kluczowej wiedzy (summaryUrl) — dzięki
 * temu nawet modele bez dostępu do internetu dostają konkrety (liczby, limity, terminy).
 *
 * Streszczenie pobieramy raz przy montażu (nie przy kliknięciu), żeby klik pozostał w geście
 * użytkownika i nie był blokowany przez popup-blocker.
 */
interface AskLLMProps {
  defaultQuery: string;
  contextUrl?: string;
  summaryUrl?: string;
}

/** Zdarzenie GA4 — pozwala zmierzyć, którego asystenta używają użytkownicy. */
export function trackHelpClick(target: string): void {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.('event', 'help_click', { help_target: target });
}

export function AskLLM({ defaultQuery, contextUrl = 'https://fermly.pl/o-aplikacji.html', summaryUrl }: AskLLMProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!summaryUrl) return;
    let cancelled = false;
    fetch(summaryUrl)
      .then(r => (r.ok ? r.text() : ''))
      .then(t => { if (!cancelled) setSummary(t.trim()); })
      .catch(() => { /* cicho — prompt zadziała bez streszczenia */ });
    return () => { cancelled = true; };
  }, [summaryUrl]);

  const buildPrompt = (): string => {
    if (summary) {
      return (
        'Masz dostęp do dokumentacji na dwa sposoby:\n\n' +
        `1. Pełna dokumentacja online: ${contextUrl}\n` +
        '   (jeśli możesz, przeczytaj ją przed odpowiedzią)\n\n' +
        `2. Streszczenie kluczowych informacji:\n${summary}\n\n` +
        `Na podstawie powyższego odpowiedz: ${query}`
      );
    }
    return `Przeczytaj ${contextUrl} i ${query}`;
  };

  const open = (provider: 'claude' | 'perplexity' | 'chatgpt') => {
    const base = {
      claude:     'https://claude.ai/new?q=',
      perplexity: 'https://www.perplexity.ai/search?q=',
      chatgpt:    'https://chatgpt.com/?q=',
    }[provider];
    trackHelpClick(`ask_llm:${provider}`);
    window.open(`${base}${encodeURIComponent(buildPrompt())}`, '_blank', 'noopener,noreferrer');
  };

  const btn = 'text-xs px-2.5 py-1.5 rounded-md text-white font-medium whitespace-nowrap transition-colors';

  return (
    <div className="flex items-center gap-2 my-1">
      <span className="text-gray-400" aria-hidden="true">🔍</span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Pytanie do asystenta AI"
        placeholder="Wpisz pytanie..."
        className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5
                   text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button onClick={() => open('claude')} title="Zapytaj Claude"
        className={`${btn} bg-[#D97757] hover:bg-[#c4674a]`}>
        Claude
      </button>
      <button onClick={() => open('perplexity')} title="Zapytaj Perplexity"
        className={`hidden sm:inline-flex ${btn} bg-[#20808D] hover:bg-[#1a6b77]`}>
        Perplexity
      </button>
      <button onClick={() => open('chatgpt')} title="Zapytaj ChatGPT"
        className={`hidden sm:inline-flex ${btn} bg-[#10a37f] hover:bg-[#0d8a6b]`}>
        ChatGPT
      </button>
    </div>
  );
}
