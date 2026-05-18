import { useState } from 'react'
import { supabase } from './supabase'
import { BarChart3, Mail, Lock, User, AlertCircle, LogIn, UserPlus } from 'lucide-react'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        if (error) throw error
        setSuccess('Амжилттай бүртгэгдлээ! Нэвтэрнэ үү.')
        setMode('login')
        setPassword('')
      }
    } catch (err) {
      // Алдааны мессежийг монголоор хөрвүүлэх
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setError('И-мэйл эсвэл нууц үг буруу байна')
      } else if (msg.includes('User already registered')) {
        setError('Энэ и-мэйл аль хэдийн бүртгэгдсэн байна')
      } else if (msg.includes('Password should be at least')) {
        setError('Нууц үг 6-аас доошгүй тэмдэгттэй байх ёстой')
      } else if (msg.includes('Unable to validate email')) {
        setError('И-мэйлийн формат буруу байна')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 p-4"
         style={{ fontFamily: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg shadow-pink-500/30 mb-3">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">KPI Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Менежментийн хяналтын самбар</p>
        </div>

        {/* Form */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white p-6">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5">
            <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Нэвтрэх
            </button>
            <button onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Бүртгүүлэх
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Овог нэр</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                         required placeholder="Бат-Эрдэнэ"
                         className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">И-мэйл</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                       required placeholder="you@example.com"
                       className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Нууц үг</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                       required minLength={6} placeholder="••••••"
                       className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
              </div>
              {mode === 'signup' && (
                <div className="text-[10px] text-slate-400 mt-1">6-аас доошгүй тэмдэгт</div>
              )}
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700">{error}</div>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              {loading ? (
                'Ачаалж байна...'
              ) : mode === 'login' ? (
                <><LogIn className="w-4 h-4" /> Нэвтрэх</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Бүртгүүлэх</>
              )}
            </button>
          </form>

          {mode === 'login' && (
            <div className="text-center mt-4 text-xs text-slate-500">
              Бүртгэлгүй юу?{' '}
              <button onClick={() => { setMode('signup'); setError('') }}
                      className="text-pink-600 font-semibold hover:underline">
                Шинэ бүртгэл үүсгэх
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} KPI Dashboard
        </div>
      </div>
    </div>
  )
}
