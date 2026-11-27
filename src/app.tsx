import { useEffect, useState } from 'preact/hooks'
import { lessonById } from './course/lessons'
import { labById } from './course/syllabus'
import { Icon } from './components/Icon'
import { Search } from './components/Search'
import { currentTheme, setTheme, type Theme } from './lib/theme'
import { href, useRoute } from './lib/router'
import { ExamPage } from './pages/ExamPage'
import { Glossary } from './pages/Glossary'
import { Home } from './pages/Home'
import { LabPage } from './pages/LabPage'
import { LessonPage } from './pages/LessonPage'
import { NotFound } from './pages/NotFound'
import { SITE } from './site'

function titleFor(parts: string[]): string {
  const [kind, id] = parts
  if (kind === 'learn' && lessonById(id)) return `${lessonById(id)!.protocol}: ${lessonById(id)!.title}`
  if (kind === 'exam' && lessonById(id)) return `Rebuild ${lessonById(id)!.protocol}`
  if (kind === 'lab' && labById(id)) return `${labById(id)!.title} lab`
  if (kind === 'glossary') return 'Glossary'
  return ''
}

export function App() {
  const route = useRoute()
  const [searching, setSearching] = useState(false)
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  const [kind, id] = route.parts

  useEffect(() => {
    scrollTo(0, 0)
    const t = titleFor(route.parts)
    document.title = t ? `${t} · ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`
  }, [route.path])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearching(true)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  let page
  if (!kind) page = <Home />
  else if (kind === 'learn' && id) page = <LessonPage id={id} query={route.query} />
  else if (kind === 'exam' && id) page = <ExamPage id={id} />
  else if (kind === 'lab' && id) page = <LabPage id={id} />
  else if (kind === 'glossary') page = <Glossary />
  else page = <NotFound />

  return (
    <>
      <header class="topbar">
        <div class="topbar-in">
          <a class="brand" href={href('/')} aria-label={`${SITE.name} home`}>
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
              <rect width="32" height="32" rx="8" class="brand-bg" />
              <path d="M6 21c4 0 4-10 8-10s4 10 8 10 3-6 4-6" fill="none" class="brand-wave" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="14" cy="11" r="2.6" class="brand-dot" />
            </svg>
            <span>{SITE.name}</span>
          </a>
          <nav class="mainnav" aria-label="Main">
            <a href={href('/')} class={!kind ? 'on' : ''}>Course</a>
            <a href={href('/glossary')} class={kind === 'glossary' ? 'on' : ''}>Glossary</a>
          </nav>
          <div class="top-actions">
            <button class="searchbtn" onClick={() => setSearching(true)} aria-label="Search">
              <Icon name="search" size={16} /><span>Search</span><kbd>/</kbd>
            </button>
            <button class="btn icon ghost" onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            {SITE.repo && (
              <a class="btn icon ghost" href={SITE.repo} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub"><Icon name="github" /></a>
            )}
          </div>
        </div>
      </header>
      <main id="main">{page}</main>
      <footer class="footer">
        <div class="footer-in">
          <span><strong>{SITE.name}</strong> is free and open source. No ads, no tracking, no account.</span>
          <span class="muted">Addresses use documentation ranges (RFC 5737, RFC 7042). Packets are generated with correct checksums.</span>
        </div>
      </footer>
      {searching && <Search onClose={() => setSearching(false)} />}
    </>
  )
}
