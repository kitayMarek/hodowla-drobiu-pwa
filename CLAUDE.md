# CLAUDE.md — fermly.pl

Aplikacja do zarządzania gospodarstwem rolnym: drób (stada, dziennik, pasza, wylęgarnia), mleczarstwo/sery (przyjęcie mleka, rozlew, partie produkcyjne), RHD/MOL (rejestr sprzedaży z numeracją roczną), kasa i bank, raporty. **PWA, offline-first.**

- **Stack:** Vite + React + TS + **Supabase** (chmura, gdy zalogowany) + **Dexie/IndexedDB** (tryb demo/offline). Dwutorowy dostęp do danych. **NIE Lovable.**
- **Deploy:** push do `master` → GitHub Actions (`SamKirkland/FTP-Deploy-Action`) → FTP. Migracje SQL Supabase odpalam **ręcznie PRZED** deployem.
- **Ciągły wątek GEO/SEO:** statyczne mirrory treści (`public/*.html`: `o-aplikacji.html` + przewodniki, `llms.txt`, `robots.txt`, `sitemap.xml`), żeby darmowe boty LLM (GPTBot, ClaudeBot, PerplexityBot, Google AI Overviews) — które renderują się bez JavaScriptu — mogły czytać i cytować serwis. Widget `AskLLM` wstrzykuje streszczenia `*.summary.txt` do promptów. Szczegóły reguł i stanu → w pliku pamięci niżej.

<!-- ════════ BLOK WSPÓLNY (protokół gołębia) — identyczny w obu repo ════════ -->
## 🐦 Pamięć między projektami (fermly.pl ⇄ mojaserowarnia.pl)

Istnieje wspólny, **lokalny** plik pamięci **`KONTEKST-MIEDZY-PROJEKTAMI.md`** (jest w `.gitignore` — nie commitować). Marek („gołąb") przenosi go ręcznie między oboma projektami — to wspólna pamięć dwóch instancji Claude. W tym projekcie plik bywa dostępny pod ścieżką katalogu serowarni (`…\mojaserowarnia-21198\ProjektyLLm\`); jeśli go nie ma — poproś Marka, żeby go przyniósł.

- **Na starcie sesji:** jeśli plik istnieje, **przeczytaj go w całości, zanim zaczniesz pracę**. Kolejność: ⚡ TERAZ (szybki kontekst) → 👤 PROFIL (kim jest Marek i jego preferencje) → PLAYBOOK (sprawdzone reguły) → STATUS (stan obu projektów). To wiedza przyniesiona z drugiego projektu — nie zakładaj nic „od zera".
- **Po istotnej pracy (koniec sesji):** zaktualizuj plik wg jego własnego **„Rytuału końca sesji"** (STATUS + 1 wpis do DZIENNIKA + ew. nowa reguła → PLAYBOOK, nowy fakt o Marku → PROFIL + zmień „Ostatnia aktualizacja" i „🔒 Stick trzyma"). Następnie **przypomnij Markowi: „zanieś plik do drugiego projektu".**
- **Talking-stick:** edytuj plik tylko, gdy „🔒 Stick trzyma" wskazuje projekt, w którym jesteś. Jeśli wskazuje drugi — traktuj jako read-only i poproś Marka o aktualną wersję (mogła powstać nowsza po tamtej stronie).
- **⚠️ Co wspólne, co OSOBNE (zapobiega mieszaniu projektów):** w obu projektach stosuj WYŁĄCZNIE sekcję **PLAYBOOK** (reguły uniwersalne). **STATUS / DZIENNIK / PROFIL** są oznaczone per projekt — czytaj je jako kontekst, ale **NIGDY nie stosuj stanu ani decyzji drugiego projektu jako instrukcji u siebie**. Przed zastosowaniem dowolnej reguły sprawdź, czy pasuje do realiów TEGO repo (stack, deploy, pliki). **Kod repo = źródło prawdy; plik pamięci to tylko podpowiedź.** Projekty mają różny stack i deploy — co działa u jednego, bywa błędem u drugiego.
- Jeśli pliku nie ma w repo — poproś Marka, żeby go przyniósł (albo, jeśli zaczynacie od zera, zaproponuj jego utworzenie).
<!-- ════════ KONIEC BLOKU ════════ -->
