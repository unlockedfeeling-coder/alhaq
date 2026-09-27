import { Link, useLocation } from 'react-router-dom'
import { Home, UserPlus, Heart, Stethoscope, FlaskConical, Pill, CreditCard, LogOut } from 'lucide-react'

export default function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: Home },
    { path: '/registration', name: 'Registration', icon: UserPlus },
    { path: '/vitals', name: 'Vitals', icon: Heart },
    { path: '/consulting', name: 'Consulting', icon: Stethoscope },
    { path: '/lab', name: 'Lab', icon: FlaskConical },
    { path: '/dispensary', name: 'Dispensary', icon: Pill },
    { path: '/cashier', name: 'Cashier', icon: CreditCard },
  ]

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col">
      <div className="p-6 text-center border-b border-slate-700">
        <h1 className="text-2xl font-bold text-green-400">🌿 Al-Haq</h1>
        <p className="text-xs text-slate-400 mt-1">Hospital System</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button className="flex items-center space-x-3 px-4 py-3 w-full text-slate-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}