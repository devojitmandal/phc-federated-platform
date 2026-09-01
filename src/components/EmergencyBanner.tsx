import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFontSize } from '@/components/FontSizeContext'
import { getOrderedLanguages } from '@/lib/regionLanguage'

export default function EmergencyBanner() {
  const { t, i18n } = useTranslation();
  const { increase, decrease, reset } = useFontSize();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-critical px-4 py-2 text-paper shadow-md">
      <div className="flex items-center gap-4">
        <span className="font-label text-xs font-semibold uppercase tracking-wide">
          {t('Medical emergency?')}
        </span>
        <a href="tel:112" className="rounded-full bg-paper px-3 py-1 font-label text-xs font-bold text-critical transition hover:bg-paper/90">
          {t('Call 112')}
        </a>
        <a href="tel:108" className="rounded-full border border-paper px-3 py-1 font-label text-xs font-bold text-paper transition hover:bg-paper/10">
          {t('Ambulance 108')}
        </a>
      </div>

      <div className="flex items-center gap-6">
        {/* Accessibility Controls */}
        <div className="flex items-center gap-2 border-r border-paper/30 pr-6">
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">{t('Text:')}</span>
          <button onClick={decrease} className="flex h-6 w-6 items-center justify-center rounded bg-paper/10 text-sm font-bold transition hover:bg-paper/20">A-</button>
          <button onClick={reset} className="flex h-6 w-6 items-center justify-center rounded bg-paper/10 text-sm font-bold transition hover:bg-paper/20">A</button>
          <button onClick={increase} className="flex h-6 w-6 items-center justify-center rounded bg-paper/10 text-sm font-bold transition hover:bg-paper/20">A+</button>
        </div>

        {/* Language selector */}
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="rounded-full border border-paper/30 bg-transparent px-2 py-1 font-label text-xs font-medium text-paper focus:outline-none"
        >
          {getOrderedLanguages().map((lang) => (
            <option key={lang.code} value={lang.code} className="text-ink">
              {lang.label}
            </option>
          ))}
        </select>

        <Link to="/staff-login" className="rounded-full border border-paper/80 px-3 py-1 font-label text-sm font-medium text-paper/90 transition hover:border-paper hover:text-paper">
          {t('PHC staff login')}
        </Link>
      </div>
    </div>
  )
}