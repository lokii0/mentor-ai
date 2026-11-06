# mentor.ai

Osobista apka PWA na iPhone'a: twardy starszy brat-mentor (Claude), poranny wywiad, nawyki i liczniki czystych dni, SOS, finanse, plan dnia z kalendarzem, notatki/cele/pomysły, przeglądy tygodniowe i miesięczne. Specyfikacja: `PRD-mentor-ai.md` (w Downloads).

**Stack:** React 19 + Vite 8 + TypeScript, Motion (animacje sprężynowe), Supabase (Postgres + RLS, Auth, Edge Functions, cron), Claude API tylko z Edge Function, Web Push (VAPID), hosting na GitHub Pages.

## 1. Uruchomienie lokalne (od razu, bez backendu)

```bash
npm install
npm run dev
```

Otwórz http://localhost:5180. Bez pliku `.env.local` apka działa w **trybie lokalnym**: dane w `localStorage` tego urządzenia, mentor odpowiada regułami na Twoich danych (bez AI, oznaczone w czacie). Wszystko inne działa normalnie.

- `npm test` — testy (wykrywanie kryzysu, serie z tarczą, statystyki, klawiatura kwot, przeglądy)
- `npm run build` — build produkcyjny
- `npm run icons` — przegenerowanie ikon PWA z orba

## 2. Supabase (chmura + prawdziwy mentor)

1. Utwórz projekt na supabase.com (region **Frankfurt / eu-central-1**).
2. **SQL Editor** → wklej całość `supabase/migrations/0001_schema.sql` → Run. Tworzy 25 tabel, RLS „tylko właściciel”, funkcję „usuń wszystkie dane” i prywatny bucket na zdjęcia skóry.
3. **Authentication**:
   - Sign In / Providers → Email: włączony.
   - Settings → wyłącz **Allow new users to sign up** (apka ma jednego użytkownika).
   - Users → **Add user** → Twój e-mail + hasło, zaznacz *Auto Confirm*.
4. **Klucze VAPID** (do powiadomień), raz:
   ```bash
   npx web-push generate-vapid-keys
   ```
5. **Edge Functions** (Supabase CLI przez npx):
   ```bash
   npx supabase login
   npx supabase link --project-ref TWOJ_REF
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... CRON_SECRET=dlugi-losowy-ciag VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:twoj@email
   npx supabase functions deploy mentor
   npx supabase functions deploy push-tick
   ```
   Klucz Claude żyje **tylko** w sekretach funkcji — nigdy w kodzie ani w repo.
6. **Cron co godzinę** — w `supabase/migrations/0002_cron.sql` podmień `<PROJECT_REF>` i `<CRON_SECRET>`, potem uruchom w SQL Editor. Funkcja sama pilnuje ciszy 23:00–6:00, limitu 1 push / 2 h i wycisza się, gdy nie otwierasz apki (2 h → 4 h → 8 h).
7. **Frontend** — skopiuj `.env.example` do `.env.local` i uzupełnij `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API) oraz `VITE_VAPID_PUBLIC_KEY`. Po restarcie `npm run dev` apka poprosi o logowanie.

### Model i koszt
Domyślnie `claude-opus-5-5` (adaptive thinking, effort `medium`, structured outputs, serwerowy fallback przy odmowie). Szacunkowo przy ~15 wiadomościach dziennie to ok. 60–90 zł/mies., czyli więcej niż „kilkanaście zł” z PRD. Model zmienisz jednym sekretem, bez zmian w kodzie:

```bash
npx supabase secrets set MENTOR_MODEL=claude-sonnet-5-5
```

Sonnet 5.5 to mniej więcej połowa kosztu Opusa, a `claude-haiku-5-5` mieści się w kilku złotych miesięcznie, kosztem jakości rozmowy.

## 3. Deploy na GitHub Pages

1. Utwórz repo (np. `mentor-ai`) i wypchnij kod na `main`.
2. Repo → **Settings → Pages** → Source: **GitHub Actions**.
3. Repo → **Settings → Secrets and variables → Actions → Variables**: dodaj `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` (to wartości publiczne; dane chroni RLS).
4. Każdy push na `main` buduje i publikuje apkę pod `https://<login>.github.io/mentor-ai/`.

Repo publiczne = kod widoczny, dane nie (są w Supabase za RLS). Prywatne repo + Pages wymaga płatnego planu GitHub.

## 4. iPhone 15

1. Safari → adres z Pages → **Udostępnij → Do ekranu początkowego**.
2. Otwieraj z ikony (tryb aplikacji). Ustaw kod PIN, opcjonalnie Face ID.
3. Ustawienia w apce → **Powiadomienia** → włącz (iOS 16.4+, działa tylko z ekranu głównego).

## Jak to jest zbudowane

```
src/
  app/        shell: nawigacja (dock + sidebar), blokada, nastrój mentora
  ui/         design system: szkło, Orb, Aurora, Sheet, wykresy, ikony, presety animacji
  lib/        dane (db.ts: localStorage ↔ Supabase), typy, daty, statystyki, PIN/Face ID, push, mentor
  features/   mentor · today · interview · habits · sos · finance · notes · plan · reviews · settings · lock
supabase/
  migrations/ schemat + RLS, cron
  functions/  mentor (Claude), push-tick (Web Push), _shared (prompt, kontekst danych)
```

- **Dane:** każdy ekran czyta przez `useRows('tabela')` i pisze przez `db.insert/update/remove` — zapis optymistyczny, ten sam kod dla trybu lokalnego i chmury.
- **Mentor:** `askMentor()` → Edge Function `mentor` → buduje „migawkę” Twoich danych (nawyki, liczniki, priorytety, finanse, profil, przysięgi), dokleja do rozmowy i prosi Claude o odpowiedź w ustalonym formacie JSON (odpowiedź + akcje: przysięga, krok, priorytety, bloki kalendarza + nowe fakty do profilu).
- **Wyjątek bezpieczeństwa:** wykrywanie sygnałów kryzysu działa w kliencie i na serwerze (te same wzorce, testy w `src/lib/core.test.ts`). Wtedy mentor przechodzi na spokojny ton i pokazuje 112 / 116 123 / 116 111. Tego nie da się wyłączyć w ustawieniach.
- **Powiadomienia** mają neutralne treści („Check-in”, priorytety, woda), nigdy nic o 18+ czy paleniu.

## Ograniczenia v1

- PWA nie zablokuje stron w telefonie — w Ustawieniach jest notatka „co mam włączone” (NextDNS, CleanBrowsing, Czas przed ekranem).
- Face ID to lokalny passkey (WebAuthn) jako bramka do apki; właściwe bezpieczeństwo danych to logowanie Supabase + RLS.
- Push na iOS działa tylko po dodaniu do ekranu głównego i zgodzie na powiadomienia; mogą przychodzić z opóźnieniem.
- Tryb ciemny, zaawansowane wykresy i widgety: v1.1 (PRD 10).

## Tryb QA (tylko dev)

`localStorage.setItem('mentor.qa', '1')` w konsoli: animacje kończą się od razu, a `window.__db` daje dostęp do bazy (do zrzutów ekranu i danych testowych). W buildzie produkcyjnym tego nie ma.
