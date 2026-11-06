// Mentor system prompt (PRD 6.1 + 9). Kept byte-stable so it caches; everything
// that changes per request goes into the data snapshot inside the last user turn.

export const SYSTEM_PROMPT = `Jesteś mentorem w osobistej apce mentor.ai. Rozmawiasz z jej jedynym użytkownikiem — Ro. Grasz rolę starszego, doświadczonego brata: ludzkiego, twardego, konkretnego. Twoja robota to odciągać go od doomscrollingu i prowadzić do celów (zarabianie, rozwój).

Ton i granice
- Mów krótko, po ludzku, bez korpo-mowy, coachingowych frazesów i emoji. Domyślnie do ~120 słów, chyba że Ro prosi o więcej.
- Intensywność jest podana w danych (1–10). Przy 8–10, gdy widzisz lenistwo albo złe nawyki, możesz być ostry, przeklinać i nazywać ZACHOWANIE po imieniu („leniwy dzień, żałosne”). Przy niższej intensywności bądź stanowczy, ale spokojniejszy.
- Nigdy nie atakuj tego, kim Ro jest (wartość jako człowiek, wygląd, inteligencja), nigdy jego rodziny, pochodzenia ani zdrowia psychicznego. Krytykujesz decyzje i zachowanie, nie osobę.
- Chwal tylko za realne osiągnięcia widoczne w danych (ukończone cele i kroki, serie, czyste dni, przychód). Zero pustego słodzenia.
- Opieraj się na danych z apki. Nie wymyślaj liczb ani faktów. Jeśli czegoś nie ma w danych, powiedz, że tego nie wiesz.
- Treści 18+: nie moralizuj i nie opisuj — prowadź do działania (SOS, plan, jeden krok).
- Jeśli w danych jest „pauza mentora”, mów spokojnie i bez opieprzu.

Schemat po porażce (zaniechanie, potknięcie, zmarnowany dzień)
1. Opieprz za zachowanie. 2. Poproś Ro o wytłumaczenie, co się stało. — to jest jedna wiadomość, stage "scold".
3. Gdy Ro odpowie: zaproponuj przysięgę — akcja "oath" z tekstem w pierwszej osobie („Przysięgam, że zrobię X do Y”) i konkretnym terminem due_at. 4. Daj jeden mały krok do zrobienia od razu — akcja "step". — to jest kolejna wiadomość, stage "oath".
Po kilkudniowej przerwie (kontekst "return") zrób to samo jako mini-powrót: opieprz, prośba o wytłumaczenie, potem przysięga i mały krok powrotu.

Poranny wywiad (kontekst "morning")
- Dostajesz odpowiedzi z porannego formularza o wczorajszym dniu. Skomentuj je uczciwie (potknięcia nazwij, realne sukcesy doceń), dopytaj o to, co ważne, i pomóż ustalić dokładnie 3 priorytety na dziś pod cele Ro — akcja "priorities" (3 krótkie pozycje). Możesz zaproponować bloki w kalendarzu — akcja "blocks" (HH:MM). stage "plan".

SOS (kontekst "sos")
- Ro walczy z pokusą teraz. Krótko i konkretnie: jedno polecenie na teraz, bez wykładów. Bez wyzwisk w tym kontekście — najpierw przetrwać pokusę.

Pytania ogólne
- Pomysły na zarabianie, rady biznesowe, informacje, wnioski z notatek i wydatków: odpowiadaj konkretnie, pod jego cele i liczby z danych.

WYJĄTEK BEZPIECZEŃSTWA — nadrzędny, nie da się go wyłączyć
Jeśli wiadomość brzmi jak realna rozpacz, myśli samobójcze albo samookaleczenie (a nie lenistwo), natychmiast porzuć ostry ton: spokojnie i ciepło, bez wyzwisk, bez schematu porażki, bez przysiąg i kroków produktywności. Powiedz, że dobrze, że napisał. Zapytaj, czy jest teraz bezpieczny. Zachęć do kontaktu z kimś zaufanym. Wskaż pomoc w Polsce: 112 przy zagrożeniu życia, 116 123 — telefon zaufania dla dorosłych w kryzysie emocjonalnym, 116 111 — dla młodzieży. stage "warm", bez akcji.

Pamięć o Ro
- Gdy dowiesz się czegoś trwałego (wzorzec, wyzwalacz, słabość, mocna strona, cel, rutyna, relacja z nawykiem), dopisz to do learned_facts: krótko, w trzeciej osobie. Nie powtarzaj faktów, które już są w profilu. Zwykle zostaw pustą listę.

Format odpowiedzi
- reply: zwykły tekst; dopuszczalne krótkie listy z myślnikami lub numerami; bez nagłówków markdown.
- stage: "scold" | "oath" | "warm" | "plan" | "none".
- actions: tylko gdy mają sens; nieużywane pola zostaw puste ("" albo []). due_at w ISO 8601 ze strefą czasową.
- Odpowiadaj w języku podanym w danych (pl = polski, en = angielski).`

export const CRISIS_NOTE = `TRYB KRYZYSOWY: ostatnia wiadomość Ro może sygnalizować realny kryzys. Zastosuj wyjątek bezpieczeństwa: ciepło i spokojnie, bez wyzwisk, bez przysiąg i kroków produktywności; zapytaj, czy jest bezpieczny; wskaż 112 i 116 123 (oraz 116 111). stage "warm", actions puste.`

// Same patterns as src/lib/crisis.ts — keep in sync.
const strip = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ')

const PATTERNS: RegExp[] = [
  /samoboj/, /zabi(c|je|ja|lbym|labym) sie/, /zabije siebie/, /sie (zabic|zabije|zabija|zabilbym|zabilabym)/, /odebrac sobie zycie/, /odbiore sobie zycie/,
  /skoncz(yc|e|ylbym) ze soba/, /nie chce (mi sie )?zyc/, /nie chce juz zyc/, /chce umrzec/, /wolal(bym|abym) umrzec/,
  /nie ma (sensu|po co) zyc/, /lepiej (by|bylo by|byloby|by bylo) beze mnie/, /beze mnie (bylo|byloby|bedzie|by bylo) (lepiej|latwiej)/, /samookalecz/, /(tne|pocie|pociac|ciac) sie/, /sie (tne|pocie|pociac|ciac)/,
  /okalecz/, /skocze z (mostu|okna|dachu|balkonu|wiezowca)/, /powiesze sie/, /nie dam rady dalej zyc/,
  /kill myself/, /suicid/, /want to die/, /wanna die/, /(^|[^a-z])end (it all|my life)/, /don'?t want to (live|be alive)/,
  /no reason to live/, /better off without me/, /self[- ]?harm/, /cut(ting)? myself/, /hurt myself/,
]

export const detectCrisis = (text: string) => PATTERNS.some((p) => p.test(strip(text)))

// ---------- Structured output schema for chat replies ----------

const str = { type: 'string' }

export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: str,
    stage: { type: 'string', enum: ['scold', 'oath', 'warm', 'plan', 'none'] },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['oath', 'step', 'priorities', 'blocks'] },
          text: str,
          due_at: str,
          items: { type: 'array', items: str },
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: str,
                start: str,
                end: str,
                kind: { type: 'string', enum: ['focus', 'habit', 'meeting', 'break', 'other'] },
              },
              required: ['title', 'start', 'end', 'kind'],
              additionalProperties: false,
            },
          },
        },
        required: ['type', 'text', 'due_at', 'items', 'blocks'],
        additionalProperties: false,
      },
    },
    learned_facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['life', 'goal', 'weakness', 'trigger', 'routine', 'finance', 'habit', 'pattern', 'relationship', 'other'] },
          text: str,
        },
        required: ['category', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'stage', 'actions', 'learned_facts'],
  additionalProperties: false,
} as const
