import { createRoot } from 'react-dom/client'
import App from './App'
import { connect } from './api'
import './styles.css'

if (!new URLSearchParams(location.search).has('preview')) connect()
createRoot(document.getElementById('root')!).render(<App />)
