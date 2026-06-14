import React from 'react';

/**
 * Dyskretny link pomocy. Dwa tryby:
 *  - `query`  → wyszukiwanie w Perplexity (wiedza branżowa: FCR, marża, przepisy…)
 *  - `href`   → bezpośredni link (np. własny przewodnik RHD / strona statyczna)
 * Zawsze otwiera się w nowej karcie i loguje zdarzenie do Google Analytics.
 */
interface HelpLinkProps {
  query?: string;
  href?: string;
  label?: string;
  icon?: string;
  className?: string;
}

/** Zdarzenie GA4 — pozwala zmierzyć, czy pomoc jest w ogóle używana. */
export function trackHelpClick(target: string): void {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.('event', 'help_click', { help_target: target });
}

export function HelpLink({ query, href, label, icon, className }: HelpLinkProps) {
  const isPerplexity = !href;
  const url = href ?? `https://www.perplexity.ai/search?q=${encodeURIComponent(query ?? '')}`;
  const text = label ?? 'Zapytaj Perplexity';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackHelpClick(href ?? `perplexity:${query ?? ''}`)}
      aria-label={`${text} (otwiera się w nowej karcie)`}
      className={
        className ??
        'inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600 transition-colors'
      }
    >
      <span aria-hidden="true">{icon ?? (isPerplexity ? '🔍' : '📄')}</span>
      <span>{text}</span>
      <span aria-hidden="true" className="text-xs opacity-60">↗</span>
    </a>
  );
}
