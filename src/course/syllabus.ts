// The course map: units follow a typical university computer networks syllabus,
// bottom-up through the layers. Each item is an animated lesson or a hands-on lab.

export interface LabMeta {
  id: string
  title: string
  blurb: string
  layer: string
}

export const labs: LabMeta[] = [
  { id: 'encapsulation', title: 'Encapsulation', layer: 'L2–L7', blurb: 'Type a message and watch each layer wrap it in a real header.' },
  { id: 'encoding', title: 'Line coding', layer: 'L1', blurb: 'Draw NRZ-L, NRZ-I, Manchester, differential Manchester and AMI signals for any bits.' },
  { id: 'error-detection', title: 'Error detection & correction', layer: 'L2', blurb: 'CRC long division, Hamming codes and the Internet checksum, step by step.' },
  { id: 'sliding-window', title: 'Sliding window protocols', layer: 'L2 / L4', blurb: 'Stop-and-Wait, Go-Back-N and Selective Repeat. Click any frame to lose it.' },
  { id: 'subnetting', title: 'Subnetting & CIDR', layer: 'L3', blurb: 'Calculate networks, masks and host ranges, then practise with generated questions.' },
  { id: 'routing', title: 'Routing algorithms', layer: 'L3', blurb: 'Run Dijkstra (link state) and Bellman-Ford (distance vector) one step at a time.' },
  { id: 'congestion', title: 'TCP congestion control', layer: 'L4', blurb: 'Slow start, congestion avoidance and fast recovery for Tahoe and Reno.' },
]

export const labById = (id: string) => labs.find((l) => l.id === id)

export interface UnitItem {
  kind: 'lesson' | 'lab'
  id: string
}

export interface Unit {
  id: string
  n: number
  title: string
  blurb: string
  items: UnitItem[]
}

export const units: Unit[] = [
  {
    id: 'foundations', n: 1, title: 'Foundations', blurb: 'Layers, headers and how data is wrapped on its way down the stack.',
    items: [{ kind: 'lab', id: 'encapsulation' }],
  },
  {
    id: 'physical', n: 2, title: 'Physical layer', blurb: 'Turning bits into signals on a wire.',
    items: [{ kind: 'lab', id: 'encoding' }],
  },
  {
    id: 'datalink', n: 3, title: 'Data link layer', blurb: 'Frames, MAC addresses, detecting errors and reliable delivery over one link.',
    items: [{ kind: 'lesson', id: 'arp' }, { kind: 'lab', id: 'error-detection' }, { kind: 'lab', id: 'sliding-window' }],
  },
  {
    id: 'network', n: 4, title: 'Network layer', blurb: 'Addressing, configuration, routing and diagnostics across networks.',
    items: [{ kind: 'lab', id: 'subnetting' }, { kind: 'lesson', id: 'dhcp' }, { kind: 'lesson', id: 'icmp' }, { kind: 'lab', id: 'routing' }],
  },
  {
    id: 'transport', n: 5, title: 'Transport layer', blurb: 'Connections, reliability, flow control and congestion control.',
    items: [{ kind: 'lesson', id: 'tcp' }, { kind: 'lab', id: 'congestion' }],
  },
  {
    id: 'application', n: 6, title: 'Application layer', blurb: 'Names and the web: the protocols users actually touch.',
    items: [{ kind: 'lesson', id: 'dns' }, { kind: 'lesson', id: 'http' }],
  },
]
