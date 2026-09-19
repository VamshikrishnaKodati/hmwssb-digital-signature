import { Info } from 'lucide-react'

/**
 * ActionPanel — compact contextual action list for the estimate detail page.
 *
 * Renders a card of actions. Item shape:
 *   { key, label, icon, tone: 'primary'|'secondary'|'danger', disabled, onClick }
 * Link-shaped actions: { key, label, icon, to, tone: 'secondary' }
 *
 * Primary = dark blue (ec-btn-primary), secondary = light/outlined
 * (ec-btn-outline), danger = red. The backend remains authoritative; pass
 * only actions validated by the caller's role/status/ownership checks.
 */
export default function ActionPanel({
  title = 'Actions',
  actions = [],
  emptyMessage = 'No action available for your role',
}) {
  // Directive: only ONE primary (dark blue); demote extra primaries to outline,
  // keep danger red. Applied here so header/panel stay one source of truth.
  let primaryUsed = false
  const cx = (tone) => {
    if (tone === 'danger') return 'ec-btn-danger'
    if (tone === 'primary' && !primaryUsed) { primaryUsed = true; return 'ec-btn-primary' }
    return 'ec-btn-outline'
  }

  return (
    <div className="ec-card" data-testid="action-panel">
      <div className="ec-card-header">
        <span className="ec-card-title">{title}</span>
      </div>
      <div className="ec-card-body space-y-2">
        {actions.length === 0 && (
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F1F5F9] text-[#2563EB]">
              <Info className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{emptyMessage}</span>
            </div>
          </div>
        )}
        {actions.map((action) =>
          action.to ? (
            <a key={action.key} href={action.to} className={`${cx(action.tone)} w-full justify-center`}>
              <action.icon className="w-4 h-4" /> {action.label}
            </a>
          ) : (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`${cx(action.tone)} w-full justify-center`}
            >
              <action.icon className="w-4 h-4" /> {action.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}