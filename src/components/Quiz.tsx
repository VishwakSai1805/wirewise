import { useState } from 'preact/hooks'
import type { QuizQuestion } from '../course/types'
import { recordQuiz } from '../lib/progress'
import { Icon } from './Icon'

export function Quiz({ id, questions }: { id: string; questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const answered = answers.filter((a) => a !== null).length
  const correct = answers.filter((a, i) => a === questions[i].answer).length

  const choose = (qi: number, oi: number) => {
    if (answers[qi] !== null) return
    const next = answers.slice()
    next[qi] = oi
    setAnswers(next)
    if (next.every((a) => a !== null)) {
      recordQuiz(id, Math.round((100 * next.filter((a, i) => a === questions[i].answer).length) / questions.length))
    }
  }

  return (
    <div class="quiz">
      {questions.map((q, qi) => {
        const a = answers[qi]
        return (
          <fieldset class="qcard" key={qi}>
            <legend><span class="qn">{qi + 1}</span>{q.q}</legend>
            <div class="opts">
              {q.options.map((o, oi) => {
                const state = a === null ? '' : oi === q.answer ? 'right' : oi === a ? 'wrong' : 'dim'
                return (
                  <button key={oi} class={`opt ${state}`} onClick={() => choose(qi, oi)} disabled={a !== null} aria-pressed={a === oi}>
                    <span class="mark">{state === 'right' ? <Icon name="check" size={15} /> : state === 'wrong' ? <Icon name="x" size={15} /> : String.fromCharCode(65 + oi)}</span>
                    {o}
                  </button>
                )
              })}
            </div>
            {a !== null && <p class={`why ${a === q.answer ? 'good' : 'bad'}`}>{a === q.answer ? 'Correct. ' : 'Not quite. '}{q.why}</p>}
          </fieldset>
        )
      })}
      <div class="quiz-foot">
        <span>{answered === questions.length ? `Score: ${correct} / ${questions.length}` : `${answered} of ${questions.length} answered`}</span>
        {answered > 0 && <button class="btn ghost" onClick={() => setAnswers(questions.map(() => null))}>Reset quiz</button>}
      </div>
    </div>
  )
}
