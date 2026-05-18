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
    // Анхны session шалгах
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        loadProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Auth state-ийн өөрчлөлтийг сонсох
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) setProfile(data)
    setLoading(false)
  }

  // Loading дэлгэц
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50"
           style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg shadow-pink-500/30 animate-pulse">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div className="text-sm text-slate-500">Шалгаж байна...</div>
        </div>
      </div>
    )
  }

  // Нэвтрээгүй бол Login
  if (!session) {
    return <Login />
  }

  // Нэвтэрсэн бол Dashboard руу profile-той хамт дамжуулна
  return <Dashboard session={session} profile={profile} />
}
