// Small building blocks shared by the labs.
import type { ComponentChildren } from 'preact'

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} class={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ label, value, min, max, onChange, suffix = '', disabled }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  suffix?: string
  disabled?: boolean
}) {
  return (
    <label class={`slider ${disabled ? 'off' : ''}`}>
      <span class="slider-top"><span>{label}</span><strong>{value}{suffix}</strong></span>
      <input type="range" min={min} max={max} value={value} disabled={disabled} onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))} />
    </label>
  )
}

export function TextField({ label, value, onInput, placeholder, mono = true, error }: {
  label: string
  value: string
  onInput: (v: string) => void
  placeholder?: string
  mono?: boolean
  error?: string
}) {
  return (
    <label class="tfield">
      <span>{label}</span>
      <input class={mono ? 'mono' : ''} value={value} placeholder={placeholder} spellcheck={false} aria-invalid={!!error} onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)} />
      {error && <span class="ferr">{error}</span>}
    </label>
  )
}

export function Note({ children, title }: { children: ComponentChildren; title?: string }) {
  return (
    <div class="note">
      {title && <strong>{title}</strong>}
      {children}
    </div>
  )
}

/** Clickable bit string, e.g. for flipping bits to inject errors. */
export function Bits({ bits, onFlip, mark, label }: { bits: string; onFlip?: (i: number) => void; mark?: (i: number) => string; label?: string }) {
  return (
    <div class="bits" role="group" aria-label={label}>
      {Array.from(bits).map((b, i) => (
        <button key={i} class={`bit ${mark ? mark(i) : ''}`} onClick={onFlip ? () => onFlip(i) : undefined} disabled={!onFlip} aria-label={`bit ${i + 1}: ${b}`}>
          {b}
        </button>
      ))}
    </div>
  )
}

export const flipAt = (s: string, i: number) => s.slice(0, i) + (s[i] === '1' ? '0' : '1') + s.slice(i + 1)
