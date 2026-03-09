import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Menu, X, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setDropdownOpen(false);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 lg:px-6 h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-white">GSE</span>
          <span className="text-blue-400">Analyser</span>
        </Link>

        {/* Desktop Right */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
            🇬🇭 Ghana Stock Exchange
          </span>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-gray-200">{user.name}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-48 py-1 z-50">
                  <Link to="/portfolio" className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-700 text-sm text-gray-200" onClick={() => setDropdownOpen(false)}>
                    <User className="w-4 h-4" /> My Portfolio
                  </Link>
                  <hr className="border-gray-700 my-1" />
                  <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-700 text-sm text-red-400 w-full text-left">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary text-sm px-3 py-1.5">Sign In</Link>
              <Link to="/register" className="btn-primary text-sm px-3 py-1.5">Get Started</Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-gray-400" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 py-3 space-y-2">
          {user ? (
            <>
              <span className="text-sm text-gray-400">Signed in as {user.email}</span>
              <button onClick={handleLogout} className="btn-danger w-full text-sm">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary w-full text-center block" onClick={() => setMenuOpen(false)}>Sign In</Link>
              <Link to="/register" className="btn-primary w-full text-center block" onClick={() => setMenuOpen(false)}>Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
