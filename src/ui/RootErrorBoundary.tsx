import { Component, type ReactNode } from 'react'
import { sheetStore } from '../scoresheet/storage'

interface State {
  error: Error | null
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error): void {
    console.error('The scoresheet app failed to load.', error)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-3xl p-6" role="alert">
          <h1>The scoresheet could not be loaded</h1>
          <p className="mt-3">{this.state.error.message}</p>
          <p className="mt-3">Saved data was not changed.</p>
          {this.state.error.message.toLowerCase().includes('saved scoresheet') && (
            <>
              <p className="mt-3">To continue, delete the saved scoresheets in this browser. This removes all saved sheets but keeps your settings.</p>
              <button
                className="mt-4"
                type="button"
                onClick={() => {
                  sheetStore.clear()
                  this.setState({ error: null })
                }}
              >
                Delete saved sheets and return home
              </button>
            </>
          )}
        </main>
      )
    }
    return this.props.children
  }
}
