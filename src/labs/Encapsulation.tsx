import { useMemo, useState } from 'preact/hooks'
import { Inspector } from '../components/Inspector'
import { layerColor } from '../components/packetInfo'
import { IP, MAC } from '../course/net'
import { data, tcpFrame, udpFrame } from '../packets/layers'
import { Note, Segmented, TextField } from './ui'

const OSI = [
  ['7', 'Application', 'Application', 'Message', '—', 'HTTP, DNS, DHCP, SMTP', 'Host'],
  ['6', 'Presentation', 'Application', 'Message', '—', 'TLS, encodings, compression', 'Host'],
  ['5', 'Session', 'Application', 'Message', '—', 'Sessions, RPC', 'Host'],
  ['4', 'Transport', 'Transport', 'Segment / datagram', 'Port', 'TCP, UDP, QUIC', 'Host'],
  ['3', 'Network', 'Internet', 'Packet', 'IP address', 'IPv4, IPv6, ICMP', 'Router'],
  ['2', 'Data link', 'Link', 'Frame', 'MAC address', 'Ethernet, Wi-Fi, ARP', 'Switch'],
  ['1', 'Physical', 'Link', 'Bits / symbols', '—', 'Cables, radio, line codes', 'Hub, repeater'],
]

export default function Encapsulation() {
  const [msg, setMsg] = useState('Hello, network!')
  const [proto, setProto] = useState<'udp' | 'tcp'>('udp')
  const text = msg.slice(0, 200) || ' '

  const packet = useMemo(() => {
    const hop = { srcMac: MAC.client, dstMac: MAC.router, ip: { src: IP.client, dst: IP.web, ttl: 64, id: 0x1234 } }
    return proto === 'udp'
      ? udpFrame(hop, 50000, 9000, data(text))
      : tcpFrame(hop, { sport: 50000, dport: 9000, seq: 1001, isn: 1000, ack: 5001, peerIsn: 5000, flags: ['PSH', 'ACK'], win: 502 }, data(text))
  }, [text, proto])

  const real = packet.layers.filter((l) => l.id !== 'pad')
  const payload = text.length
  const headers = real.filter((l) => l.id !== 'data').reduce((a, l) => a + l.end - l.start, 0)
  const pad = packet.bytes.length - real.reduce((a, l) => a + l.end - l.start, 0)
  const onWire = packet.bytes.length + 4 + 8 + 12 // + FCS, preamble/SFD, inter-frame gap
  // top row = application data alone; each row below adds one more header
  const rows = real.map((_, i) => real.slice(real.length - 1 - i))
  const names = ['Data link', 'Network', 'Transport', 'Application']

  return (
    <div class="lab-grid">
      <div class="card">
        <div class="lab-controls">
          <TextField label="Your message" value={msg} onInput={setMsg} mono={false} />
          <Segmented label="Transport" value={proto} onChange={setProto} options={[{ value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }]} />
        </div>
        <h2 class="mt">Going down the stack</h2>
        <p class="muted">Each layer treats everything from the layer above as opaque data and puts its own header in front.</p>
        <div class="encap">
          {rows.map((layers, i) => {
            const outer = layers[0]
            return (
              <div class="encap-line" key={i}>
                <span class="encap-label">{names[4 - layers.length] ?? ''}<small>{outer.short}</small></span>
                <div class="encap-bar">
                  {layers.map((l) => (
                    <span key={l.id} style={{ flexGrow: Math.max(6, l.end - l.start), background: layerColor(l.id) }} title={`${l.name}: ${l.end - l.start} bytes`}>
                      {l.id === 'data' ? `data ${l.end - l.start} B` : `${l.short} ${l.end - l.start} B`}
                    </span>
                  ))}
                  {layers.length === real.length && pad > 0 && <span class="pad" style={{ flexGrow: Math.max(4, pad), background: layerColor('pad') }}>pad {pad} B</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div class="kpis">
          <div><span>Your data</span><strong>{payload} B</strong></div>
          <div><span>Headers</span><strong>{headers} B</strong></div>
          <div><span>On the wire*</span><strong>{onWire} B</strong></div>
          <div><span>Efficiency</span><strong>{Math.round((100 * payload) / onWire)}%</strong></div>
        </div>
        <p class="fine">* Frame plus the 4-byte FCS (CRC-32), the 8-byte preamble and the 12-byte inter-frame gap. Try one character, then 200: small messages are mostly overhead.</p>
      </div>

      <div class="card">
        <h2>The real frame</h2>
        <p class="muted">These are the actual bytes, checksums included. Click any field.</p>
        <Inspector packet={packet} key={proto + text} />
      </div>

      <div class="card">
        <h2>OSI and TCP/IP side by side</h2>
        <div class="table-wrap">
          <table class="lab-table">
            <thead><tr><th>#</th><th>OSI layer</th><th>TCP/IP layer</th><th>Unit (PDU)</th><th>Addressing</th><th>Examples</th><th>Device</th></tr></thead>
            <tbody>{OSI.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <Note title="Remember">
          Headers are added on the way down (encapsulation) and removed on the way up (decapsulation). A switch reads up to layer 2, a router up to layer 3, and only the end hosts look at layers 4 to 7.
        </Note>
      </div>
    </div>
  )
}
