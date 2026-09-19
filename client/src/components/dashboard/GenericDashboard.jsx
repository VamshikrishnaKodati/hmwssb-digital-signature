import { Settings } from 'lucide-react'

export default function GenericDashboard({ user, role }) {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="ec-page-title">Welcome, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          <span className="flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-amber-500" />
            Dashboard not yet configured for <strong className="ml-1">{role}</strong> role.
          </span>
        </p>
      </div>
      <div className="bg-white rounded-lg border border-[#CBD5E1] p-8 text-center">
        <Settings className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
        <p className="text-sm font-medium text-[#0F172A] mb-1">Role Dashboard Not Configured</p>
        <p className="text-xs text-[#475569] max-w-md mx-auto">
          The <strong>{role}</strong> role does not have a dedicated dashboard yet.
          Contact your system administrator to configure this dashboard.
        </p>
      </div>
    </div>
  )
}
