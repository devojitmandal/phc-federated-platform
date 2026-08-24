interface RecalculateRollupsButtonProps {
  onRecalculate: () => Promise<void>
  refreshing: boolean
}

export default function RecalculateRollupsButton({
  onRecalculate,
  refreshing,
}: RecalculateRollupsButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void onRecalculate()}
      disabled={refreshing}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {refreshing ? 'Recalculating…' : 'Recalculate rollups'}
    </button>
  )
}
