import { useState, useEffect } from 'react'
import Dashboard from './Dashboard.jsx'
import Login from './Login.jsx'
import { supabase } from './supabase'
import { BarChart3 } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        loadProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) setProfile(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
           style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <div className="blob-container">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
          <div className="blob blob-4"></div>
        </div>
        <div className="glass-main text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/30 animate-pulse">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div className="text-sm text-slate-600 glass rounded-full px-4 py-2 inline-block">Шалгаж байна...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return <Dashboard session={session} profile={profile} />
}
