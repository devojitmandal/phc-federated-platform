interface StockTrendProps {
  data: Array<{ date: string; quantity: number; label?: string }>
  title?: string
}

export default function StockTrend({ data, title }: StockTrendProps) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No trend data available.</p>
  }

  const max = Math.max(...data.map((d) => d.quantity), 1)
  const min = Math.min(...data.map((d) => d.quantity))
  const range = max - min || 1

  const points = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100
      const y = 100 - ((d.quantity - min) / range) * 80 - 10
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div>
      {title && <h3 className="mb-2 text-sm font-medium text-slate-700">{title}</h3>}
      <svg viewBox="0 0 100 100" className="h-32 w-full" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  )
}
