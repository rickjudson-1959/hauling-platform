import { useId, useState } from 'react'

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> & {
  showLabel?: string
  hideLabel?: string
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12Z"
      />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.73 10.73a2.75 2.75 0 0 0 3.54 3.54"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 5.4C10.28 5.14 11.12 5 12 5c6 0 9.75 7 9.75 7a16.8 16.8 0 0 1-2.62 3.86"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.47 6.7C4.5 8.1 2.95 10.15 2.25 12c0 0 3.75 7 9.75 7 1.62 0 3.1-.37 4.4-1"
      />
    </svg>
  )
}

export default function PasswordInput({
  className = '',
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  id,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const label = visible ? hideLabel : showLabel

  return (
    <div className="relative">
      <input
        {...props}
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={label}
        aria-pressed={visible}
        aria-controls={inputId}
        className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-lg px-3 text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
