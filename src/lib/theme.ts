export type Theme = 'light' | 'dark'

export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem('wirewise:theme', t)
  } catch {
    /* ignore */
  }
}
