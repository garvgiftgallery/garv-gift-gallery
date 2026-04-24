import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext'; // <-- Import the brain
import Navbar from './components/Navbar';
import ShopGallery from './pages/ShopGallery';
import Cart from './pages/Cart';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login'; // <-- Import the Login page
import AdminLogin from './pages/AdminLogin';
import Profile from './pages/Profile';

function App() {
  const { currentUser } = useAuth(); // Check if someone is logged in!

  return (
    <Router>
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ padding: '2rem 5%', maxWidth: '1400px', margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<ShopGallery />} /> 
            <Route path="/cart" element={<Cart />} /> 
            <Route path="/login" element={<Login />} /> 
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin-portal-access" element={<AdminLogin />} />
            {/* THE BOUNCER: If logged in, show Admin. If not, teleport to Login */}
            <Route 
              path="/garv-secure-admin" 
              element={currentUser ? <AdminDashboard /> : <Navigate to="/admin-portal-access" />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;