// Renders the PWA icons from one SVG (the mentor orb on midnight). Neutral by design:
// no text, nothing that hints at what the app tracks (PRD 4).
// Usage: npm run icons
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const orb = (size, pad) => {
  const r = (size - pad * 2) / 2
  const c = size / 2
  return `
  <defs>
    <radialGradient id="body" cx="50%" cy="62%" r="60%">
      <stop offset="0" stop-color="#0d47c4"/><stop offset=".46" stop-color="#09318d"/><stop offset="1" stop-color="#041a4f"/>
    </radialGradient>
    <radialGradient id="sky" cx="72%" cy="30%" r="45%"><stop offset="0" stop-color="#0593c6" stop-opacity=".95"/><stop offset="1" stop-color="#0593c6" stop-opacity="0"/></radialGradient>
    <radialGradient id="pink" cx="66%" cy="76%" r="42%"><stop offset="0" stop-color="#d83995" stop-opacity=".9"/><stop offset="1" stop-color="#d83995" stop-opacity="0"/></radialGradient>
    <radialGradient id="ice" cx="34%" cy="30%" r="40%"><stop offset="0" stop-color="#bff0ff" stop-opacity=".9"/><stop offset="1" stop-color="#7fdcff" stop-opacity="0"/></radialGradient>
    <radialGradient id="spec" cx="34%" cy="22%" r="22%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#0593c6" stop-opacity=".35"/><stop offset="1" stop-color="#0593c6" stop-opacity="0"/></radialGradient>
    <radialGradient id="rim" cx="50%" cy="40%" r="55%"><stop offset=".8" stop-color="#02070a" stop-opacity="0"/><stop offset="1" stop-color="#02070a" stop-opacity=".45"/></radialGradient>
    <clipPath id="clip"><circle cx="${c}" cy="${c}" r="${r}"/></clipPath>
  </defs>
  <circle cx="${c}" cy="${c}" r="${r * 1.35}" fill="url(#halo)"/>
  <g clip-path="url(#clip)">
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#body)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#sky)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#pink)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#ice)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#rim)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#spec)"/>
  </g>
  <circle cx="${c}" cy="${c}" r="${r - 0.5}" fill="none" stroke="#fff" stroke-opacity=".22"/>`
}

const icon = (size, pad, bg = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${
    bg ? `<rect width="${size}" height="${size}" fill="#02070a"/><rect width="${size}" height="${size}" fill="url(#bgglow)"/>` : ''
  }<defs><radialGradient id="bgglow" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#09318d" stop-opacity=".7"/><stop offset="1" stop-color="#02070a" stop-opacity="0"/></radialGradient></defs>${orb(size, pad)}</svg>`

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon.svg', icon(512, 96))

const out = [
  ['apple-touch-icon.png', 180, 30],
  ['icon-192.png', 192, 34],
  ['icon-512.png', 512, 92],
  ['maskable-512.png', 512, 140], // safe zone for Android masks
]
for (const [name, size, pad] of out) {
  await sharp(Buffer.from(icon(size, pad))).png().toFile(`public/icons/${name}`)
}
// Monochrome badge for Android notifications
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="34" fill="#fff"/></svg>`)).png().toFile('public/icons/badge-96.png')
console.log('icons written to public/icons')
