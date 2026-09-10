import BrandMark from '../../shared/components/BrandMark'

const TRUST = ['dispatch', 'trucks', 'drivers', 'invoices'] as const

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:flex">
        <img
          src="/brand/01-login-hero-16x9.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-gray-950/25 to-transparent" />
        <div className="relative z-10 mt-auto flex w-full max-w-xl flex-col gap-4 p-10 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BrandMark />
            <span>Hauling</span>
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Run your hauling day in one place.
          </h1>
          <p className="text-base text-white/85">
            Trucks, jobs, drivers, and invoices without the spreadsheet mess.
          </p>
          <p className="text-sm font-medium text-white/90">Open the dashboard</p>
          <TrustRow className="text-white/75" />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="relative h-52 overflow-hidden lg:hidden">
          <img
            src="/brand/01b-login-hero-9x16.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/75 via-gray-950/30 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end gap-2 px-5 pb-5 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BrandMark />
              <span>Hauling</span>
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              Run your hauling day in one place.
            </h1>
            <p className="text-sm text-white/85">
              Trucks, jobs, drivers, and invoices without the spreadsheet mess.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm space-y-5">
            {children}
            <TrustRow className="justify-center text-gray-400 lg:hidden" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TrustRow({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium uppercase tracking-wide ${className}`}>
      {TRUST.map((item, i) => (
        <li key={item} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
