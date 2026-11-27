import { useState } from 'preact/hooks'
import { CRC_PRESETS, crc, crcCheck, hammingDecode, hammingEncode, internetChecksum, isBits, isParityPos, parseWords } from './algo/errors'
import { Bits, Note, Segmented, TextField, flipAt } from './ui'

const hex4 = (n: number) => n.toString(16).padStart(4, '0')

function CrcPanel() {
  const [data, setData] = useState('1101011111')
  const [gen, setGen] = useState('10011')
  const [errors, setErrors] = useState<Set<number>>(new Set())
  const ok = isBits(data) && data.length <= 32 && isBits(gen) && gen.length >= 2 && gen[0] === '1' && gen.length <= 17
  if (!ok) {
    return (
      <div class="card">
        <CrcInputs data={data} gen={gen} setData={setData} setGen={setGen} reset={() => setErrors(new Set())} />
        <p class="hint bad">Data must be 1–32 bits; the generator must start with 1 and have 2–17 bits.</p>
      </div>
    )
  }
  const r = crc(data, gen)
  let received = r.codeword
  errors.forEach((i) => { if (i < received.length) received = flipAt(received, i) })
  const check = crcCheck(received, gen)
  const flip = (i: number) => { const n = new Set(errors); if (n.has(i)) n.delete(i); else n.add(i); setErrors(n) }

  return (
    <>
      <div class="card">
        <CrcInputs data={data} gen={gen} setData={setData} setGen={(g) => { setGen(g); setErrors(new Set()) }} reset={() => setErrors(new Set())} />
        <h3 class="mt">1 · Append {gen.length - 1} zeros, then divide by {gen} (XOR, no borrows)</h3>
        <pre class="division" aria-label="Long division steps">
          <span class="dv-top">{data}<span class="dv-pad">{'0'.repeat(gen.length - 1)}</span></span>{'\n'}
          {r.steps.map((s, k) => (
            <span key={k}>
              {' '.repeat(s.at)}<span class="dv-win">{s.window}</span>{'\n'}
              {' '.repeat(s.at)}<span class="dv-gen">{s.divisor}</span>{'   XOR\n'}
              {' '.repeat(s.at)}{'─'.repeat(gen.length)}{'\n'}
              {' '.repeat(s.at)}<span class="dv-res">{s.result}</span>{'\n'}
            </span>
          ))}
          {' '.repeat(data.length)}<span class="dv-rem">{r.remainder}</span>{'   ← remainder (CRC)'}
        </pre>
        <h3>2 · Transmit data + CRC</h3>
        <div class="codeword mono"><span>{data}</span><span class="rem">{r.remainder}</span></div>
      </div>
      <div class="card">
        <h3>3 · Receiver: divide the whole codeword. Click bits to corrupt them.</h3>
        <Bits bits={received} onFlip={flip} mark={(i) => `${errors.has(i) ? 'err' : ''} ${i >= data.length ? 'tail' : ''}`} label="Received codeword" />
        <div class={`verdict ${check.ok ? (errors.size ? 'warn' : 'good') : 'bad'}`}>
          Remainder <span class="mono">{check.remainder}</span>:{' '}
          {check.ok
            ? errors.size ? `zero, so the ${errors.size} error${errors.size > 1 ? 's were' : ' was'} NOT detected. The error pattern is a multiple of the generator.` : 'zero, frame accepted.'
            : `non-zero, error detected. The frame is discarded.`}
        </div>
        <Note>A CRC with r check bits catches every single-bit error, every burst of length ≤ r, and any odd number of errors if the generator has (x + 1) as a factor. Ethernet uses CRC-32.</Note>
      </div>
    </>
  )
}

function CrcInputs({ data, gen, setData, setGen, reset }: { data: string; gen: string; setData: (s: string) => void; setGen: (s: string) => void; reset: () => void }) {
  return (
    <div class="lab-controls">
      <TextField label="Data bits" value={data} onInput={(v) => { setData(v.replace(/\s/g, '')); reset() }} />
      <TextField label="Generator" value={gen} onInput={(v) => setGen(v.replace(/\s/g, ''))} />
      <label class="tfield"><span>Preset</span>
        <select value={CRC_PRESETS.find((p) => p.gen === gen)?.gen ?? ''} onChange={(e) => setGen((e.currentTarget as HTMLSelectElement).value)}>
          <option value="" disabled>Custom</option>
          {CRC_PRESETS.map((p) => <option key={p.gen} value={p.gen}>{p.name}</option>)}
        </select>
      </label>
    </div>
  )
}

function HammingPanel() {
  const [data, setData] = useState('1011')
  const [flipped, setFlipped] = useState<number | null>(null)
  const valid = isBits(data) && data.length <= 16
  const enc = hammingEncode(valid ? data : '1011')
  const received = flipped !== null && flipped < enc.n ? flipAt(enc.code, flipped) : enc.code
  const dec = hammingDecode(received)
  const label = (pos: number) => {
    if (isParityPos(pos)) return `P${pos}`
    return `D${pos}`
  }

  return (
    <>
      <div class="card">
        <div class="lab-controls">
          <TextField label="Data bits (up to 16)" value={data} onInput={(v) => { setData(v.replace(/\s/g, '')); setFlipped(null) }} error={valid ? undefined : 'Use 1–16 bits of 0 and 1.'} />
          <div class="kpis small"><div><span>Data bits m</span><strong>{valid ? data.length : 4}</strong></div><div><span>Parity bits r</span><strong>{enc.r}</strong></div><div><span>Code</span><strong>({enc.n},{enc.n - enc.r})</strong></div></div>
        </div>
        <p class="muted">r is the smallest number with 2<sup>r</sup> ≥ m + r + 1. Parity bits sit at positions 1, 2, 4, 8…; position 1 is the leftmost bit. Even parity.</p>
        <div class="table-wrap">
          <table class="lab-table hamming">
            <thead>
              <tr><th>Position</th>{Array.from({ length: enc.n }, (_, i) => <th key={i}>{i + 1}</th>)}</tr>
              <tr><th>Binary</th>{Array.from({ length: enc.n }, (_, i) => <td key={i} class="mono small">{(i + 1).toString(2).padStart(enc.r, '0')}</td>)}</tr>
            </thead>
            <tbody>
              <tr><th>Role</th>{Array.from({ length: enc.n }, (_, i) => <td key={i} class={isParityPos(i + 1) ? 'par' : ''}>{label(i + 1)}</td>)}</tr>
              <tr><th>Sent</th>{Array.from(enc.code).map((b, i) => <td key={i} class={`mono ${isParityPos(i + 1) ? 'par' : ''}`}>{b}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <ul class="eqs">
          {enc.checks.map((c) => (
            <li key={c.p}><span class="mono">P{c.p}</span> covers positions {c.covers.join(', ')} → <strong class="mono">{c.value}</strong></li>
          ))}
        </ul>
      </div>
      <div class="card">
        <h3>Receiver: click one bit to flip it</h3>
        <Bits bits={received} onFlip={(i) => setFlipped(flipped === i ? null : i)} mark={(i) => `${flipped === i ? 'err' : ''} ${isParityPos(i + 1) ? 'par' : ''}`} label="Received code word" />
        <ul class="eqs">
          {dec.checks.map((c) => (
            <li key={c.p} class={c.ok ? 'ok' : 'fail'}>Check P{c.p} (positions {c.covers.join(', ')}): {c.ok ? 'even ✓' : 'odd ✗'}</li>
          ))}
        </ul>
        <div class={`verdict ${dec.syndrome ? 'warn' : 'good'}`}>
          Syndrome = {dec.checks.slice().reverse().map((c) => (c.ok ? 0 : 1)).join('')}₂ = {dec.syndrome}.{' '}
          {dec.syndrome ? `Bit ${dec.syndrome} is wrong; flipping it back gives ${dec.corrected}.` : 'No error.'}
        </div>
        <Note>Adding the positions of the failed checks gives the position of the bad bit. With one extra overall parity bit (SECDED), double errors can be detected too.</Note>
      </div>
    </>
  )
}

function ChecksumPanel() {
  const [text, setText] = useState('4500 0073 0000 4000 4011 0000 c0a8 0001 c0a8 00c7')
  const words = parseWords(text)
  const valid = !!words && words.every((w) => w <= 0xffff) && words.length <= 64
  const r = internetChecksum(valid ? words! : [0])
  const verify = internetChecksum([...(valid ? words! : [0]), r.checksum])
  return (
    <div class="card">
      <TextField label="16-bit words in hex (the checksum field set to 0000)" value={text} onInput={setText} error={valid ? undefined : 'Enter up to 64 hex words of at most 4 digits.'} />
      <p class="muted">Example: an IPv4 header. Add the words using ones’ complement arithmetic: any carry out of the top bit wraps around and is added back in.</p>
      <div class="table-wrap">
        <table class="lab-table sum">
          <thead><tr><th>#</th><th>Word</th><th>Running sum</th><th /></tr></thead>
          <tbody>
            {r.steps.map((s, i) => (
              <tr key={i}><td>{i + 1}</td><td class="mono">{hex4(s.word)}</td><td class="mono">{hex4(s.sum)}</td><td class="muted">{s.carry ? 'carry wrapped around (+1)' : ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="kpis">
        <div><span>Sum</span><strong class="mono">{hex4(r.sum)}</strong></div>
        <div><span>Checksum = NOT sum</span><strong class="mono">{hex4(r.checksum)}</strong></div>
        <div><span>Receiver’s sum incl. checksum</span><strong class="mono">{hex4(verify.sum)}</strong></div>
      </div>
      <Note>The receiver adds every word including the checksum. A result of ffff (all ones) means no error was detected. IP, ICMP, UDP and TCP all use this checksum; it is cheap but weaker than a CRC (swapping two words goes unnoticed).</Note>
    </div>
  )
}

export default function ErrorDetection() {
  const [tab, setTab] = useState<'crc' | 'hamming' | 'checksum'>('crc')
  return (
    <div class="lab-grid">
      <div class="tabbar">
        <Segmented label="Technique" value={tab} onChange={setTab} options={[
          { value: 'crc', label: 'CRC' }, { value: 'hamming', label: 'Hamming code' }, { value: 'checksum', label: 'Internet checksum' },
        ]} />
      </div>
      {tab === 'crc' && <CrcPanel />}
      {tab === 'hamming' && <HammingPanel />}
      {tab === 'checksum' && <ChecksumPanel />}
    </div>
  )
}
