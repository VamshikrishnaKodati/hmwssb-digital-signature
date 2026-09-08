import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, User } from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from '../components/Logo'
import InputField from '../components/login/InputField'
import PasswordField from '../components/login/PasswordField'
import LoadingButton from '../components/login/LoadingButton'
import DemoAccounts from '../components/login/DemoAccounts'

const validators = {
  username: (v) => {
    const trimmed = (v || '').trim()
    if (!trimmed) return 'Username is required.'
    return ''
  },
  password: (v) => {
    const trimmed = (v || '').trim()
    if (!trimmed) return 'Password is required.'
    return ''
  },
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const usernameRef = useRef(null)
  const passwordRef = useRef(null)
  const submitting = useRef(false)

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const validate = useCallback((field, value) => {
    const fn = validators[field]
    if (!fn) return ''
    const err = fn(value)
    setErrors(prev => {
      const next = { ...prev }
      if (err) next[field] = err
      else delete next[field]
      return next
    })
    return err
  }, [])

  const validateAll = useCallback(() => {
    const ue = validators.username(username)
    const pe = validators.password(password)
    const errs = {}
    if (ue) errs.username = ue
    if (pe) errs.password = pe
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [username, password])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading || submitting.current) return
    if (!validateAll()) return
    submitting.current = true
    setLoading(true)
    try {
      await login(username.trim(), password)
      toast.success('Login successful.\nWelcome back!')
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid username or password.'
      setErrors({ password: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleUsernameKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      validate('username', username)
      passwordRef.current?.focus()
    }
  }

  const handlePasswordKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      validate('password', password)
      handleSubmit(e)
    }
  }

  const handleDemoSelect = (usernameVal, passwordVal) => {
    setUsername(usernameVal)
    setPassword(passwordVal || '')
    setErrors(prev => {
      const next = { ...prev }
      delete next.username
      delete next.password
      return next
    })
    passwordRef.current?.focus()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#F0F4F8] via-white to-[#F0F4F8] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(30,58,95,0.035)_0%,transparent_65%)] pointer-events-none" />

      <div className="bg-white border-b border-[#E5E7EB] px-5 sm:px-6 py-3 flex items-center justify-center gap-4">
        <Logo size={36} />
        <div className="text-center">
          <p className="text-xs sm:text-sm font-semibold text-[#1E293B] leading-tight">HYDERABAD METROPOLITAN WATER SUPPLY AND SEWERAGE BOARD</p>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">Government of Telangana &middot; Works Management System</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl shadow-[0_12px_36px_rgba(15,23,42,0.08)] border border-[#E2E8F0] overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#1E3A5F] via-[#1E3A5F]/80 to-[#1E3A5F]/60" />

            <div className="px-6 pt-5 pb-2 text-center">
              <Logo size={100} />
              <h2 className="text-lg font-bold text-[#0F172A] mt-3">Welcome Back</h2>
              <p className="text-xs text-[#64748B] mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="px-6 pb-5 space-y-[14px]">
              <InputField
                ref={usernameRef}
                label="Username"
                name="username"
                value={username}
                onChange={e => { setUsername(e.target.value); if (errors.username) validate('username', e.target.value) }}
                placeholder="Enter your username"
                icon={User}
                error={errors.username}
                autoComplete="username"
                autoFocus
                spellCheck={false}
                onKeyDown={handleUsernameKey}
                disabled={loading}
                required
                className="h-[48px] pr-4"
              />
              <PasswordField
                ref={passwordRef}
                label="Password"
                name="password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (errors.password) validate('password', e.target.value) }}
                placeholder="Enter your password"
                error={errors.password}
                autoComplete="current-password"
                onKeyDown={handlePasswordKey}
                disabled={loading}
                required
                className="h-[48px]"
              />
              <LoadingButton
                type="submit"
                loading={loading}
                loadingText="Signing In..."
                disabled={loading}
                className="ec-btn-primary w-full justify-center h-[50px] text-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </LoadingButton>
            </form>
          </div>

          {import.meta.env.DEV && <DemoAccounts onSelect={handleDemoSelect} className="mt-6" />}
        </div>
      </div>

      <footer className="px-4 py-5 text-center">
        <p className="text-[11px] text-[#94A3B8]">
          &copy; {new Date().getFullYear()} Hyderabad Metropolitan Water Supply &amp; Sewerage Board
        </p>
        <p className="text-[10px] text-[#94A3B8]">Government of Telangana</p>
        <p className="text-[10px] text-[#CBD5E1] mt-0.5">Version 1.0.0</p>
      </footer>
    </div>
  )
}
