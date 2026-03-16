import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Component } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import BossMode from './components/BossMode';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, stack: '' }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Draft room crash:', error, info);
    this.setState({ stack: info?.componentStack || '' });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#fff', background: '#111', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>💥</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Draft room crashed</h2>
          <pre style={{ background: '#1e1e1e', color: '#f87171', padding: '12px 16px', borderRadius: 8, fontSize: 12, maxWidth: 700, width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          {this.state.stack && (
            <pre style={{ background: '#1e1e1e', color: '#94a3b8', padding: '12px 16px', borderRadius: 8, fontSize: 11, maxWidth: 700, width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto' }}>
              {'Component stack:' + this.state.stack}
            </pre>
          )}
          <button onClick={() => window.history.back()} style={{ padding: '8px 20px', borderRadius: 8, background: '#378ADD', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>
            ← Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreateLeague from './pages/CreateLeague';
import JoinLeague from './pages/JoinLeague';
import LeagueHome from './pages/LeagueHome';
import DraftRoom from './pages/DraftRoom';
import Leaderboard from './pages/Leaderboard';
import AdminScores from './pages/AdminScores';
import PaymentSuccess from './pages/PaymentSuccess';
import EntryPaymentSuccess from './pages/EntryPaymentSuccess';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import StrategyHub from './pages/StrategyHub';
import FAQ from './pages/FAQ';
import SuperAdmin from './pages/SuperAdmin';
import Games from './pages/Games';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-950">
          <Navbar />
          <BossMode />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/create-league" element={<ProtectedRoute><CreateLeague /></ProtectedRoute>} />
            <Route path="/join-league" element={<ProtectedRoute><JoinLeague /></ProtectedRoute>} />
            <Route path="/league/:id" element={<ProtectedRoute><LeagueHome /></ProtectedRoute>} />
            <Route path="/league/:id/draft" element={<ProtectedRoute><ErrorBoundary><DraftRoom /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/league/:id/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/league/:id/admin" element={<ProtectedRoute><AdminScores /></ProtectedRoute>} />
            {/* Legacy commissioner payment success — kept so old bookmarks don't 404 */}
            <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
            {/* Per-league access fee payment success page */}
            <Route path="/payment/entry-success" element={<ProtectedRoute><EntryPaymentSuccess /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/strategy" element={<ProtectedRoute><StrategyHub /></ProtectedRoute>} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
