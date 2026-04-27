import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Page Components
import ShopGallery from './pages/ShopGallery';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const { currentUser } = useAuth(); // Check if someone is logged in!

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
        {/* Main Content Area: Optimized for Full-Screen Mobile */}
        <main 
          className="w-full lg:max-w-[1400px] mx-auto flex-1" 
          style={{ padding: '2rem 5%' }}
        >
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<ShopGallery />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />

            {/* Secure Admin Portal Access */}
            <Route path="/admin-portal-access" element={<AdminLogin />} />
            
            {/* THE BOUNCER: Only allows Admin access */}
            <Route 
              path="/garv-secure-admin" 
              element={currentUser ? <AdminDashboard /> : <Navigate to="/admin-portal-access" />} 
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