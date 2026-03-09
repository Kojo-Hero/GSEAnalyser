import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Briefcase, Calculator,
  FileText, Bot, ChevronRight, HelpCircle
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/valuation', icon: Calculator, label: 'DCF Valuation' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/faq', icon: HelpCircle, label: 'FAQ' },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-56 bg-gray-900 border-r border-gray-800 pt-14 pb-4 z-30 shrink-0">
      {/* pt-16 offsets the Navbar height */}
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* Bottom Info — pinned to the bottom of the sidebar */}
      <div className="mt-auto px-3">
        <div className="px-3 py-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <p className="text-xs text-gray-500 font-medium">Market Status</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-emerald-400 font-semibold">Live Data</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">GSE • Accra</p>
        </div>
      </div>
    </aside>
  );
}
