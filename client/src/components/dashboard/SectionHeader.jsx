export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div>
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-[11px] text-[#94A3B8] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
