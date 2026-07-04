import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const style = document.createElement('style')
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); opacity: 0.3; }
    50% { transform: translateY(-6px); opacity: 1; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f13; color: #e8e8f0; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
