export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white ${className}`}
      aria-hidden="true"
    >
      H
    </span>
  )
}
