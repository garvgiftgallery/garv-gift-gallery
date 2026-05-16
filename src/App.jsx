import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Page Components
import ShopGallery from './pages/ShopGallery';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AuthPage from './pages/AuthPage';

function App() {
  // 🚨 GRAB THE USER TIER FROM CONTEXT
  const { currentUser, userTier } = useAuth(); 

  return (
    <Router>
      <div 
        className="w-full min-h-screen flex flex-col bg-[#F9F8F6]" 
        style={{ 
          fontFamily: 'system-ui, -apple-system, sans-serif', 
          backgroundColor: '#F9F8F6' 
        }}
      >
        <Navbar />
        
        {/* ✨ FIXED: Removed 'lg:max-w-[1400px]' and horizontal padding (5%). 
            This allows the inner components (like ShopGallery) to stretch edge-to-edge! */}
        <main 
          className="w-full flex-1" 
          style={{ paddingTop: '2rem', paddingBottom: '2rem' }}
        >
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<ShopGallery />} />
            <Route path="/cart" element={<Cart />} />
            
            {/* Profile Route: Kick them to login if NOT logged in */}
            <Route 
              path="/profile" 
              element={currentUser ? <Profile /> : <Navigate to="/login" />} 
            />
           
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />

            {/* Secure Admin Portal Access */}
            <Route path="/admin-portal-access" element={<AdminLogin />} />
            
            {/* 🚨 THE UPGRADED BOUNCER: Only allows true Admins access */}
            <Route 
              path="/garv-secure-admin" 
              element={userTier === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} 
            />

            {/* Fallback for undefined routes */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;