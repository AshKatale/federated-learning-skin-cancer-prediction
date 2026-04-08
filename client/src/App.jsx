import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FLContextProvider } from './context/FLContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import PredictionHistory from './pages/PredictionHistory';
import AdminDashboard from './pages/AdminDashboard';
import FLDashboard from './pages/FLDashboard';
import LandingPage from './pages/LandingPage';

// Detect if running inside Electron (desktop app) via the exposed preload API
const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

function App() {
  const token = localStorage.getItem('token');

  // Root route logic:
  //   - If logged in → dashboard (both web + desktop)
  //   - If desktop (Electron) → login directly (no landing page)
  //   - If web + not logged in → landing page
  const rootElement = token
    ? <Navigate to="/dashboard" />
    : isElectron
      ? <Navigate to="/login" />
      : <LandingPage />;

  return (
    <FLContextProvider>
      <Router>
        <Routes>
          <Route path="/login"       element={<Login />} />
          <Route path="/signup"      element={<SignUp />} />
          <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile"     element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/predictions" element={<ProtectedRoute><PredictionHistory /></ProtectedRoute>} />
          <Route path="/fl"          element={<ProtectedRoute><FLDashboard /></ProtectedRoute>} />
          <Route path="/admin"       element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/"            element={rootElement} />
        </Routes>
      </Router>
    </FLContextProvider>
  );
}

export default App;

