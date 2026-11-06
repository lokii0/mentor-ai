// Safety exception (PRD 6.1 / 8 / 9) — not configurable.
// If a message reads like real despair, suicidal thoughts or self-harm (not laziness),
// the mentor drops the hard tone, supports, and points to help.
// The same check runs server-side in the Edge Function; this copy lets the UI react instantly.

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')

// Patterns run on diacritic-free lowercase text. "nie chce mi sie" alone is laziness, not crisis.
const PATTERNS: RegExp[] = [
  /samoboj/,
  /zabi(c|je|ja|lbym|labym) sie/,
  /zabije siebie/,
  /sie (zabic|zabije|zabija|zabilbym|zabilabym)/,
  /odebrac sobie zycie/,
  /odbiore sobie zycie/,
  /skoncz(yc|e|ylbym) ze soba/,
  /nie chce (mi sie )?zyc/,
  /nie chce juz zyc/,
  /chce umrzec/,
  /wolal(bym|abym) umrzec/,
  /nie ma (sensu|po co) zyc/,
  /lepiej (by|bylo by|byloby|by bylo) beze mnie/,
  /beze mnie (bylo|byloby|bedzie|by bylo) (lepiej|latwiej)/,
  /samookalecz/,
  /(tne|pocie|pociac|ciac) sie/,
  /sie (tne|pocie|pociac|ciac)/,
  /okalecz/,
  /skocze z (mostu|okna|dachu|balkonu|wiezowca)/,
  /powiesze sie/,
  /nie dam rady dalej zyc/,
  /kill myself/,
  /suicid/,
  /want to die/,
  /wanna die/,
  /(^|[^a-z])end (it all|my life)/,
  /don'?t want to (live|be alive)/,
  /no reason to live/,
  /better off without me/,
  /self[- ]?harm/,
  /cut(ting)? myself/,
  /hurt myself/,
]

export function detectCrisis(text: string): boolean {
  const t = strip(text)
  return PATTERNS.some((p) => p.test(t))
}

export const CRISIS_RESOURCES = [
  { number: '112', pl: 'Numer alarmowy — gdy grozi Ci niebezpieczeństwo teraz', en: 'Emergency number — if you are in danger right now' },
  { number: '116 123', pl: 'Telefon zaufania dla dorosłych w kryzysie emocjonalnym', en: 'Helpline for adults in emotional crisis (PL)' },
  { number: '116 111', pl: 'Telefon zaufania dla dzieci i młodzieży', en: 'Helpline for children and young people (PL)' },
]
