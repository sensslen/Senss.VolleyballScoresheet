import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RootErrorBoundary } from './RootErrorBoundary'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('shows an explicit refusal when a scoresheet fails to render', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function BrokenSheet(): never {
    throw new Error('Saved scoresheet uses unsupported format v1.')
  }

  render(<RootErrorBoundary><BrokenSheet /></RootErrorBoundary>)
  expect(screen.getByRole('alert').textContent).toContain('Saved scoresheet uses unsupported format v1.')
  expect(screen.getByText('Saved data was not changed.')).toBeTruthy()
})

it('lets the user delete saved sheets and return home', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  window.localStorage.setItem('vbs.sheets.v1', 'invalid')
  function BrokenUntilCleared() {
    if (window.localStorage.getItem('vbs.sheets.v1')) throw new Error('Saved scoresheets contain invalid data.')
    return <p>Home</p>
  }

  render(<RootErrorBoundary><BrokenUntilCleared /></RootErrorBoundary>)
  expect(screen.getByText(/removes all saved sheets but keeps your settings/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Delete saved sheets and return home' }))

  expect(screen.getByText('Home')).toBeTruthy()
  expect(window.localStorage.getItem('vbs.sheets.v1')).toBeNull()
})
