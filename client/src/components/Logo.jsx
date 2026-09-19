const modules = import.meta.glob('../assets/logo/*', { eager: true, query: '?url', import: 'default' })
const availableFiles = Object.keys(modules)

let logoSrc = null
if (availableFiles.some(f => f.endsWith('.png'))) {
  logoSrc = modules[availableFiles.find(f => f.endsWith('.png'))]
} else if (availableFiles.some(f => f.endsWith('.svg'))) {
  logoSrc = modules[availableFiles.find(f => f.endsWith('.svg'))]
}

if (!logoSrc) {
  console.warn('Official HMWSSB logo asset not found. Using placeholder branding.')
}

function LogoIcon({ size }) {
  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt="HMWSSB Official Logo"
        style={{ height: size, width: 'auto' }}
        className="object-contain shrink-0"
      />
    )
  }
  const s = Math.round(size * 0.8)
  return (
    <div
      className="rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: s, height: s, fontSize: Math.round(size * 0.3) }}
    >
      H
    </div>
  )
}

export default function Logo({ size = 40, variant = 'icon' }) {
  if (variant === 'full') {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <LogoIcon size={size} />
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-[#0F172A] leading-tight">HMWS&SB</p>
          <p className="text-[14px] text-[#475569] leading-tight whitespace-nowrap"> Government of Telangana .</p>
          <p className="text-[11px] text-[#475569] leading-tight whitespace-nowrap">Works Management System</p>
          
        </div>
      </div>
    )
  }

  return <LogoIcon size={size} />
}
