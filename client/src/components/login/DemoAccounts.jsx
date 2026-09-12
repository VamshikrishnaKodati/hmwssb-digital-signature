import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, User } from 'lucide-react'

const ROLE_LABELS = {
  Manager: 'Manager',
  DGM: 'DGM',
  GM: 'GM',
  CGM: 'CGM',
  DOP: 'DOP',
  ED: 'ED',
  MD: 'MD',
  SoRAdmin: 'SoR Admin',
  DirectorOfAdministration: 'Director of Administration',
  FinanceHead: 'Finance Head',
  FinanceManager: 'Finance Manager',
  FinanceClerk: 'Finance Clerk',
  TenderOfficer: 'Tender Officer',
  SiteEngineer: 'Site Engineer',
  BillingOfficer: 'Billing Officer',
  Administrator: 'Administrator',
}

const FALLBACK_ACCOUNTS = [
  { username: 'manager', role: 'Manager' },
  { username: 'dgm', role: 'DGM' },
  { username: 'gm', role: 'GM' },
  { username: 'cgm', role: 'CGM' },
  { username: 'dop', role: 'DOP' },
  { username: 'ed', role: 'ED' },
  { username: 'md', role: 'MD' },
  { username: 'soradmin', role: 'SoRAdmin' },
  { username: 'director_admin', role: 'DirectorOfAdministration' },
  { username: 'finance_clerk', role: 'FinanceClerk' },
  { username: 'finance_manager', role: 'FinanceManager' },
  { username: 'finance_head', role: 'FinanceHead' },
  { username: 'tender_officer', role: 'TenderOfficer' },
  { username: 'site_engineer', role: 'SiteEngineer' },
  { username: 'billing_officer', role: 'BillingOfficer' },
  { username: 'admin_officer', role: 'Administrator' },
]

const FALLBACK_DEV_PASSWORD = 'password123'

export default function DemoAccounts({ onSelect, className = '' }) {
  const [open, setOpen] = useState(true)
  const [accounts, setAccounts] = useState(FALLBACK_ACCOUNTS)
  const [devPassword, setDevPassword] = useState(FALLBACK_DEV_PASSWORD)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    fetch('/api/auth/demo-accounts')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('demo accounts unavailable'))))
      .then(data => {
        if (!active) return

        const nextAccounts = Array.isArray(data?.accounts) && data.accounts.length > 0 ? data.accounts : FALLBACK_ACCOUNTS
        const nextPassword = data?.devPassword || FALLBACK_DEV_PASSWORD

        setAccounts(nextAccounts)
        setDevPassword(nextPassword)
        setError('')
      })
      .catch(() => {
        if (!active) return
        setAccounts(FALLBACK_ACCOUNTS)
        setDevPassword(FALLBACK_DEV_PASSWORD)
        setError('')
      })

    return () => { active = false }
  }, [])

  const handleClick = (account) => {
    const password = typeof account?.password === 'string' && account.password.trim()
      ? account.password
      : devPassword

    if (typeof onSelect === 'function') {
      onSelect(account.username, password)
    }
  }

  return (
    <div className={`border border-[#E2E8F0] rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <User className="w-3 h-3" />
          Demo Accounts
          <span className="text-[9px] text-[#CBD5E1]">(DEV/UAT only)</span>
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1 animate-fadeIn">
          {error ? (
            <p className="text-[10px] text-[#EF4444]">{error}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(acc => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => handleClick(acc)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#1E3A5F] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors"
                  >
                    <User className="w-2.5 h-2.5" />
                    {ROLE_LABELS[acc.role] || acc.role}{acc.name && acc.name !== (ROLE_LABELS[acc.role] || acc.role) ? ` · ${acc.name}` : ''}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#94A3B8]">
                Password: <span className="font-medium text-[#64748B]">{devPassword}</span>
                <span className="text-[#CBD5E1]"> &middot; fills on click</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
