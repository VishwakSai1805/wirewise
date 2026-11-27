import { render } from 'preact'
import { App } from './app'
import './styles/global.css'
import './styles/labs.css'

render(<App />, document.getElementById('app')!)
