import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import Portfolio from './pages/Portfolio';
import Valuation from './pages/Valuation';
import Reports from './pages/Reports';
import AIAssistant from './pages/AIAssistant';
import Login from './pages/Login';
import Register from './pages/Register';
import FAQ from './pages/FAQ';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-950 flex flex-col">
          <Navbar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 lg:ml-56 overflow-y-auto p-4 lg:p-6" style={{ height: 'calc(100vh - 56px)' }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/stocks/:ticker" element={<StockDetail />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/valuation" element={<Valuation />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/ai" element={<AIAssistant />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/faq" element={<FAQ />} />
              </Routes>
            </main>
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
              success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' } },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
