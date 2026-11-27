import { useState } from 'preact/hooks'
import { intToIp, ipToInt, parseCidr, randomQuestion, split, subnet, toBinary } from './algo/subnet'
import { Note, Segmented, Slider, TextField } from './ui'

function BinaryView({ ip, mask, prefix }: { ip: number; mask: number; prefix: number }) {
  const row = (label: string, n: number) => {
    const bits = toBinary(n).replace(/\./g, '')
    return (
      <div class="binrow">
        <span class="binlabel">{label}</span>
        <span class="binbits">
          {Array.from(bits).map((b, i) => (
            <span key={i} class={`${i < prefix ? 'net' : 'host'} ${i % 8 === 7 && i < 31 ? 'gap' : ''}`}>{b}</span>
          ))}
        </span>
        <span class="mono muted">{intToIp(n)}</span>
      </div>
    )
  }
  return (
    <div class="binview">
      {row('Address', ip)}
      {row('Mask', mask)}
      {row('Network', (ip & mask) >>> 0)}
      <div class="legend"><span class="net">network bits ({prefix})</span><span class="host">host bits ({32 - prefix})</span></div>
    </div>
  )
}

function Calculator() {
  const [input, setInput] = useState('192.168.10.77/26')
  const [splitTo, setSplitTo] = useState(0)
  const parsed = parseCidr(input)
  if (!parsed) {
    return (
      <div class="card">
        <TextField label="Address with prefix or mask" value={input} onInput={setInput} placeholder="10.1.2.3/20 or 10.1.2.3 255.255.240.0" error="Try 192.168.1.10/24 or 192.168.1.10 255.255.255.0" />
      </div>
    )
  }
  const s = subnet(parsed.ip, parsed.prefix)
  const setPrefix = (p: number) => setInput(`${intToIp(parsed.ip)}/${p}`)
  const target = splitTo > s.prefix ? splitTo : 0
  const parts = target ? split(s.network, s.prefix, target) : null
  const rows: [string, string][] = [
    ['Network address', `${intToIp(s.network)}/${s.prefix}`],
    ['Subnet mask', `${intToIp(s.mask)}`],
    ['Wildcard mask', intToIp(s.wildcard)],
    ['Broadcast address', intToIp(s.broadcast)],
    ['First usable host', intToIp(s.first)],
    ['Last usable host', intToIp(s.last)],
    ['Usable hosts', s.prefix >= 31 ? `${s.hosts} (${s.prefix === 31 ? 'point-to-point link, RFC 3021' : 'single host'})` : `${s.hosts.toLocaleString()}  (2^${32 - s.prefix} − 2)`],
    ['Total addresses', s.size.toLocaleString()],
    ['Historic class', s.cls],
    ['Scope', s.scope],
  ]
  return (
    <>
      <div class="card">
        <div class="lab-controls">
          <TextField label="Address with prefix or mask" value={input} onInput={setInput} />
          <Slider label="Prefix length" value={s.prefix} min={0} max={32} onChange={setPrefix} suffix={`  (/${s.prefix})`} />
        </div>
        <BinaryView ip={s.ip} mask={s.mask} prefix={s.prefix} />
        <dl class="results">
          {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd class="mono">{v}</dd></div>)}
        </dl>
      </div>
      <div class="card">
        <div class="section-head">
          <h2>Split this network</h2>
          <label class="inline">into subnets of
            <select value={target} onChange={(e) => setSplitTo(Number((e.currentTarget as HTMLSelectElement).value))}>
              <option value={0}>choose a prefix</option>
              {Array.from({ length: Math.min(30, 32) - s.prefix }, (_, i) => s.prefix + i + 1).filter((p) => p <= 30).map((p) => (
                <option key={p} value={p}>/{p}: {2 ** (p - s.prefix)} subnets × {2 ** (32 - p) - 2} hosts</option>
              ))}
            </select>
          </label>
        </div>
        {parts ? (
          <div class="table-wrap">
            <table class="lab-table">
              <thead><tr><th>#</th><th>Network</th><th>First host</th><th>Last host</th><th>Broadcast</th></tr></thead>
              <tbody>
                {parts.subnets.map((p, i) => (
                  <tr key={i}><td>{i + 1}</td><td class="mono">{intToIp(p.network)}/{p.prefix}</td><td class="mono">{intToIp(p.first)}</td><td class="mono">{intToIp(p.last)}</td><td class="mono">{intToIp(p.broadcast)}</td></tr>
                ))}
              </tbody>
            </table>
            {parts.count > parts.subnets.length && <p class="fine">Showing the first {parts.subnets.length} of {parts.count.toLocaleString()} subnets.</p>}
          </div>
        ) : <p class="muted">Borrowing b host bits creates 2<sup>b</sup> subnets, each with 2<sup>(32 − prefix − b)</sup> − 2 usable hosts.</p>}
      </div>
    </>
  )
}

type Ans = { network: string; broadcast: string; first: string; last: string; hosts: string }
const EMPTY: Ans = { network: '', broadcast: '', first: '', last: '', hosts: '' }

function Practice() {
  const [q, setQ] = useState(randomQuestion)
  const [ans, setAns] = useState<Ans>(EMPTY)
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const s = subnet(q.ip, q.prefix)
  const truth: Ans = { network: intToIp(s.network), broadcast: intToIp(s.broadcast), first: intToIp(s.first), last: intToIp(s.last), hosts: String(s.hosts) }
  const correct = (k: keyof Ans) => (k === 'hosts' ? ans.hosts.replace(/[,\s]/g, '') === truth.hosts : ipToInt(ans[k]) === ipToInt(truth[k]) && ipToInt(ans[k]) !== null)
  const keys: [keyof Ans, string][] = [['network', 'Network address'], ['broadcast', 'Broadcast address'], ['first', 'First usable host'], ['last', 'Last usable host'], ['hosts', 'Number of usable hosts']]

  const check = () => {
    if (checked) return
    setChecked(true)
    const all = keys.every(([k]) => correct(k))
    setScore({ right: score.right + (all ? 1 : 0), total: score.total + 1 })
  }
  const next = () => { setQ(randomQuestion()); setAns(EMPTY); setChecked(false) }

  return (
    <div class="card">
      <div class="section-head">
        <h2>Question</h2>
        <span class="muted">Score: {score.right} / {score.total} fully correct</span>
      </div>
      <p class="question">A host has the address <strong class="mono">{intToIp(q.ip)}/{q.prefix}</strong> (mask <span class="mono">{intToIp(s.mask)}</span>).</p>
      <div class="practice">
        {keys.map(([k, label]) => (
          <label key={k} class={`tfield ${checked ? (correct(k) ? 'right' : 'wrong') : ''}`}>
            <span>{label}</span>
            <input class="mono" value={ans[k]} disabled={checked} onInput={(e) => setAns({ ...ans, [k]: (e.currentTarget as HTMLInputElement).value })} onKeyDown={(e) => { if (e.key === 'Enter') check() }} />
            {checked && !correct(k) && <span class="ferr">Answer: {truth[k]}</span>}
          </label>
        ))}
      </div>
      <div class="exam-actions">
        {!checked ? <button class="btn primary" onClick={check}>Check</button> : <button class="btn primary" onClick={next}>Next question</button>}
        {!checked && <button class="btn ghost" onClick={next}>Skip</button>}
      </div>
      <Note title="Method">
        Find the “interesting” octet where the mask is neither 255 nor 0. Block size = 256 − that mask octet. The network address is the largest multiple of the block size not above the host’s octet; the broadcast is the next block’s start minus one.
      </Note>
    </div>
  )
}

export default function Subnetting() {
  const [tab, setTab] = useState<'calc' | 'practice'>('calc')
  return (
    <div class="lab-grid">
      <div class="tabbar">
        <Segmented label="Mode" value={tab} onChange={setTab} options={[{ value: 'calc', label: 'Calculator' }, { value: 'practice', label: 'Practice' }]} />
      </div>
      {tab === 'calc' ? <Calculator /> : <Practice />}
    </div>
  )
}
