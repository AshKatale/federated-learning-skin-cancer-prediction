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

function App() {
  const token = localStorage.getItem('token');

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
          <Route path="/"            element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </FLContextProvider>
  );
}

export default App;
