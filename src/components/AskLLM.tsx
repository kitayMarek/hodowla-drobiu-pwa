import { useState } from 'react';

/**
 * Widget „Zapytaj LLM" — pole z gotowym pytaniem + przyciski Claude / Perplexity / ChatGPT.
 * Do pytania dokleja prefiks „Przeczytaj {contextUrl} i …", więc każdy z modeli najpierw
 * czyta naszą stronę statyczną (opis aplikacji / przewodnik RHD), a dopiero potem odpowiada.
 */
interface AskLLMProps {
  defaultQuery: string;
  contextUrl?: string;
}

/** Zdarzenie GA4 — pozwala zmierzyć, którego asystenta używają użytkownicy. */
export function trackHelpClick(target: string): void {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.('event', 'help_click', { help_target: target });
}

export function AskLLM({ defaultQuery, contextUrl = 'https://fermly.pl/o-aplikacji.html' }: AskLLMProps) {
  const [query, setQuery] = useState(defaultQuery);
  const fullQuery = `Przeczytaj ${contextUrl} i ${query}`;

  const urls = {
    claude:     `https://claude.ai/new?q=${encodeURIComponent(fullQuery)}`,
    perplexity: `https://www.perplexity.ai/search?q=${encodeURIComponent(fullQuery)}`,
    chatgpt:    `https://chatgpt.com/?q=${encodeURIComponent(fullQuery)}`,
  } as const;

  const open = (provider: keyof typeof urls) => {
    trackHelpClick(`ask_llm:${provider}`);
    window.open(urls[provider], '_blank', 'noopener,noreferrer');
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
