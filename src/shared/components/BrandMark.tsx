export default function BrandMark({
  className = '',
  inverted = false,
}: {
  className?: string
  inverted?: boolean
}) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
        inverted ? 'bg-white text-brand' : 'bg-brand text-white'
      } ${className}`}
      aria-hidden="true"
    >
      H
    </span>
  )
}
