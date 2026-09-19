import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Eye } from 'lucide-react'
import api from '../utils/api'
import StatusBadge from '../components/shared/StatusBadge'

export default function PendingApprovals() {
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const res = await api.get('/workflow/pending')
      setEstimates(res.data)
    } catch (_) { /* ignore */ }
    setLoading(false)
  }

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>

  const roleLabel = {
    DGM: 'Estimates awaiting your verification',
    GM: 'Estimates awaiting your digital signing & OTP verification',
    CGM: 'Estimates awaiting your submission for approval',
    DOP: 'Estimates awaiting your approval',
    ED: 'Estimates awaiting your approval',
    MD: 'Estimates awaiting your final approval',
    TenderOfficer: 'Estimates ready for tender',
    DirectorOfAdministration: 'Estimates awaiting agency selection',
    SiteEngineer: 'Works awaiting action',
    BillingOfficer: 'Completed works awaiting billing',
    Administrator: 'Estimates awaiting archiving',
  }

  const nextAction = {
    Submitted: 'Verify & Forward',
    DGM_Approved: 'Digital Sign + OTP',
    GM_Recommended: 'Submit for Approval',
    CGM_Submitted: 'Approve',
    DOP_Approved: 'Approve',
    ED_Approved: 'Final Approve',
    Signed: 'Publish Tender',
    TenderPublished: 'Select Agency',
    AgencySelected: 'Start Work',
    WorkStarted: 'Complete Work',
    WorkCompleted: 'Submit Bill',
    Billing: 'Archive & Close',
  }

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <h1 className="ec-page-title">My Queue</h1>
        <p className="ec-page-subtitle">{roleLabel[user.Designation] || 'Estimates assigned to you'}</p>
      </div>

      {estimates.length === 0 ? (
        <div className="ec-card py-12 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-[#94A3B8]" />
          <p className="text-sm text-[#475569]">No pending items in your queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map(e => (
            <Link key={e.EstimateID} to={`/estimates/${e.EstimateID}`}
              className="block bg-white rounded-lg border border-[#CBD5E1] p-4 hover:border-[#2563EB]/30 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={e.Status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{e.NameOfWork}</p>
                    <p className="text-[10px] text-[#475569]">
                      {e.EstimateNo} · v{e.Version} · {e.CreatedByName}
                    </p>
                    {nextAction[e.Status] && (
                      <p className="text-[10px] mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#2563EB] font-medium">
                        Next: {nextAction[e.Status]}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-semibold text-[#2563EB]">
                    ₹ {parseFloat(e.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <Eye className="w-4 h-4 text-[#475569]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
