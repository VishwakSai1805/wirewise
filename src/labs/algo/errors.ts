// CRC long division, Hamming codes and the Internet checksum, with the
// intermediate steps a student would write on paper.

export const isBits = (s: string) => /^[01]+$/.test(s)

const xorBits = (a: string, b: string) => Array.from(a, (c, i) => (c === b[i] ? '0' : '1')).join('')

export interface CrcStep { at: number; window: string; divisor: string; result: string }

export function crc(data: string, gen: string) {
  const r = gen.length - 1
  const padded = data + '0'.repeat(r)
  const bits = padded.split('')
  const steps: CrcStep[] = []
  for (let i = 0; i < data.length; i++) {
    if (bits[i] !== '1') continue
    const window = bits.slice(i, i + gen.length).join('')
    const result = xorBits(window, gen)
    for (let k = 0; k < gen.length; k++) bits[i + k] = result[k]
    steps.push({ at: i, window, divisor: gen, result })
  }
  const remainder = bits.slice(data.length).join('')
  return { padded, steps, remainder, codeword: data + remainder }
}

/** Receiver side: divide the whole codeword; a zero remainder means no error detected. */
export function crcCheck(codeword: string, gen: string) {
  const bits = codeword.split('')
  for (let i = 0; i <= bits.length - gen.length; i++) {
    if (bits[i] !== '1') continue
    for (let k = 0; k < gen.length; k++) bits[i + k] = bits[i + k] === gen[k] ? '0' : '1'
  }
  const remainder = bits.slice(bits.length - (gen.length - 1)).join('')
  return { remainder, ok: !remainder.includes('1') }
}

export const CRC_PRESETS = [
  { name: 'CRC-3 (x³ + x + 1)', gen: '1011' },
  { name: 'CRC-4 (x⁴ + x + 1)', gen: '10011' },
  { name: 'CRC-8 (x⁸ + x² + x + 1)', gen: '100000111' },
  { name: 'CRC-CCITT-16', gen: '10001000000100001' },
]

// ------------------------------------------------------------------ Hamming

const isPow2 = (n: number) => (n & (n - 1)) === 0

export function parityBitsFor(m: number) {
  let r = 0
  while (2 ** r < m + r + 1) r++
  return r
}

export interface HammingCheck { p: number; covers: number[]; value: string; ok?: boolean }

/** Even-parity Hamming code. Position 1 is the leftmost bit; parity bits sit at 1, 2, 4, 8… */
export function hammingEncode(data: string) {
  const r = parityBitsFor(data.length)
  const n = data.length + r
  const code: string[] = new Array(n + 1).fill('0')
  let d = 0
  for (let pos = 1; pos <= n; pos++) if (!isPow2(pos)) code[pos] = data[d++]
  const checks: HammingCheck[] = []
  for (let p = 1; p <= n; p <<= 1) {
    const covers: number[] = []
    for (let pos = 1; pos <= n; pos++) if (pos & p) covers.push(pos)
    const ones = covers.filter((pos) => pos !== p && code[pos] === '1').length
    code[p] = ones % 2 ? '1' : '0'
    checks.push({ p, covers, value: code[p] })
  }
  return { code: code.slice(1).join(''), checks, r, n }
}

export function hammingDecode(code: string) {
  const n = code.length
  const checks: HammingCheck[] = []
  let syndrome = 0
  for (let p = 1; p <= n; p <<= 1) {
    const covers: number[] = []
    for (let pos = 1; pos <= n; pos++) if (pos & p) covers.push(pos)
    const ones = covers.filter((pos) => code[pos - 1] === '1').length
    const ok = ones % 2 === 0
    if (!ok) syndrome += p
    checks.push({ p, covers, value: code[p - 1], ok })
  }
  const corrected = syndrome && syndrome <= n
    ? code.slice(0, syndrome - 1) + (code[syndrome - 1] === '1' ? '0' : '1') + code.slice(syndrome)
    : code
  return { syndrome, checks, corrected }
}

export const isParityPos = isPow2

// ------------------------------------------------------------------ checksum

export interface SumStep { word: number; sum: number; carry: boolean }

/** Ones' complement sum with end-around carry, then complement (RFC 1071). */
export function internetChecksum(words: number[]) {
  let sum = 0
  const steps: SumStep[] = []
  for (const w of words) {
    sum += w
    const carry = sum > 0xffff
    if (carry) sum = (sum & 0xffff) + 1
    steps.push({ word: w, sum, carry })
  }
  return { steps, sum, checksum: ~sum & 0xffff }
}

export function parseWords(text: string): number[] | null {
  const clean = text.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, ' ').trim()
  if (!clean) return null
  const tokens = clean.split(/\s+/)
  const words: number[] = []
  for (const t of tokens) {
    if (t.length > 4) {
      if (t.length % 4) return null
      for (let i = 0; i < t.length; i += 4) words.push(parseInt(t.slice(i, i + 4), 16))
    } else words.push(parseInt(t, 16))
  }
  return words
}
