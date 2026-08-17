import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card" aria-label={title}>
      {(title || actions) && (
        <header className="card-head">
          <div className="min-w-0">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="muted mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  // The hint sits outside the label: inside it, it would become part of the
  // control's accessible name.
  return (
    <div className="field">
      <label className="flex flex-col gap-1.5">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'date' | 'time' | 'number' | 'password'
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = '--',
  required,
  disabled,
  hint,
}: {
  label: string
  value: T | ''
  options: Array<{ value: T; label: string }>
  onChange: (value: T | '') => void
  placeholder?: string
  /** Set where something is always chosen, so there is no empty row to fall back to. */
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.target.value as T | '')}
      >
        {!required && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Banner({ kind, children }: { kind: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  return <div className={`banner banner-${kind}`}>{children}</div>
}

export function Spinner({ label }: { label: string }) {
  return (
    <p className="muted flex items-center gap-2" role="status">
      <span
        aria-hidden
        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500"
      />
      {label}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
