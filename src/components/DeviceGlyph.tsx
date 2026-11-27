import type { DeviceKind } from '../course/types'

/** Line drawings of network devices, centred on (0, 0), about 36 px wide. */
export function DeviceGlyph({ kind }: { kind: DeviceKind }) {
  switch (kind) {
    case 'laptop':
      return (
        <g>
          <rect x="-13" y="-12" width="26" height="17" rx="2" />
          <path d="M-18 9h36l-3 3h-30z" />
        </g>
      )
    case 'pc':
      return (
        <g>
          <rect x="-14" y="-13" width="28" height="19" rx="2" />
          <path d="M0 6v6M-7 12h14" />
        </g>
      )
    case 'router':
      return (
        <g>
          <rect x="-16" y="-1" width="32" height="12" rx="3" />
          <path d="M-9-1l-3-10M9-1l3-10" />
          <circle cx="-9" cy="5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="-4" cy="5" r="1.3" fill="currentColor" stroke="none" />
          <path d="M3 5h8" />
        </g>
      )
    case 'switch':
      return (
        <g>
          <rect x="-18" y="-7" width="36" height="14" rx="3" />
          <path d="M-11-1v3M-5-1v3M1-1v3M7-1v3M13-1v3" />
        </g>
      )
    case 'server':
      return (
        <g>
          <rect x="-11" y="-15" width="22" height="30" rx="2.5" />
          <path d="M-11-5h22M-11 5h22" />
          <circle cx="-5" cy="-10" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="-5" cy="0" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="-5" cy="10" r="1.3" fill="currentColor" stroke="none" />
        </g>
      )
    case 'dns':
      return (
        <g>
          <ellipse cx="0" cy="-10" rx="12" ry="4.5" />
          <path d="M-12-10v20c0 2.5 5.4 4.5 12 4.5s12-2 12-4.5v-20M-12 0c0 2.5 5.4 4.5 12 4.5S12 2.5 12 0" />
        </g>
      )
    case 'printer':
      return (
        <g>
          <path d="M-9-5v-8h18v8" />
          <rect x="-15" y="-5" width="30" height="13" rx="2" />
          <path d="M-9 4h18v9h-18z" />
        </g>
      )
    case 'phone':
      return (
        <g>
          <rect x="-8" y="-14" width="16" height="28" rx="3" />
          <path d="M-3 10h6" />
        </g>
      )
    case 'cloud':
      return <path d="M-22 12a10 10 0 0 1 1-20 14 14 0 0 1 27-3 10 10 0 0 1 16 9 7 7 0 0 1-2 14z" />
  }
}
