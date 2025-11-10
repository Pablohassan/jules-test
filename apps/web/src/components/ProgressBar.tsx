import { motion } from 'framer-motion'

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
      <motion.div
        className="h-full bg-indigo-600"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  )
}

export function InlineBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-2 inline-flex items-center bg-gray-100 text-gray-800 border border-gray-200 rounded px-2 py-1 text-xs">
      {children}
    </span>
  )
}

