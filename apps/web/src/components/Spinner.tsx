export default function Spinner({ size = 24 }: { size?: number }) {
  const s = `${size}px`;
  return (
    <svg className="animate-spin text-indigo-600" width={s} height={s} viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" opacity=".25" />
        <path d="M22 12a10 10 0 0 1-10 10" />
      </g>
    </svg>
  )
}

