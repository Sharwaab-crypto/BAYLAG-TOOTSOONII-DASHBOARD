import { useState } from 'react'
import { supabase } from './supabase'
import { BarChart3, Mail, Lock, AlertCircle, LogIn } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setError('И-мэйл эсвэл нууц үг буруу байна')
      } else if (msg.includes('Email not confirmed')) {
        setError('И-мэйл хаягаа баталгаажуулна уу')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px 10px 40px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    fontSize: '14px',
    color: '#334155',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
         style={{ fontFamily: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* Анимэйшнтэй бөмбөрцгүүд */}
      <div className="blob-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="blob blob-4"></div>
      </div>

      <div className="w-full max-w-md glass-main">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/30 mb-3">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">KPI Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">Менежментийн хяналтын самбар</p>
        </div>

        {/* Glass Form */}
        <div className="glass-strong rounded-3xl p-6">
          <div className="text-center mb-5">
            <div className="text-base font-bold text-slate-800 mb-1">Нэвтрэх</div>
            <div className="text-xs text-slate-500">Бүртгэлтэй хэрэглэгчид нэвтрэнэ үү</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">И-мэйл</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ width: '16px', height: '16px', zIndex: 2 }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                       required placeholder="you@example.com" style={inputStyle} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Нууц үг</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ width: '16px', height: '16px', zIndex: 2 }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                       required placeholder="••••••" style={inputStyle} />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50/80 backdrop-blur border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700">{error}</div>
              </div>
            )}

            <button type="submit" disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white text-sm font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              {loading ? 'Ачаалж байна...' : <><LogIn className="w-4 h-4" /> Нэвтрэх</>}
            </button>
          </form>

          <div className="text-center mt-4 text-[10px] text-slate-500 leading-relaxed">
            Бүртгэлтэй хэрэглэгчид л нэвтрэх боломжтой.<br />
            Шинэ бүртгэл хэрэгтэй бол админд хандана уу.
          </div>
        </div>

        <div className="text-center mt-4 text-xs text-slate-500">
          © {new Date().getFullYear()} KPI Dashboard
        </div>
      </div>
    </div>
  )
}
