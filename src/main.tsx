import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './i18n'
import './styles.css'
import { RootErrorBoundary } from './ui/RootErrorBoundary'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <RootErrorBoundary>
    <StrictMode>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </StrictMode>
  </RootErrorBoundary>,
)
