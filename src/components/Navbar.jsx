import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { totalItems } = useCart();
  const { currentUser, searchQuery, setSearchQuery } = useAuth();

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <img src="/assets/logo.png" alt="Logo" style={styles.logo} onError={(e) => { e.target.src = "https://via.placeholder.com/40?text=G"; }} />
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1 style={styles.title}>
            GARV <span style={{ fontWeight: '300', color: '#C5A059' }}>GIFT GALLERY</span>
          </h1>
        </Link>
      </div>

      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="Search products, tags..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.controls}>
        {/* ✨ NEW: Seamless User Icon (Replaces text button) */}
        <Link to={currentUser ? "/profile" : "/login"} style={styles.iconButton} aria-label="User Profile">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        </Link>

        {/* Existing Cart Icon (Badge hides when 0) */}
        <Link to="/cart" style={styles.iconButton} aria-label="Shopping Cart">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          {totalItems > 0 && <span style={styles.badge}>{totalItems}</span>}
        </Link>
      </div>
    </nav>
  );
};

const styles = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 5%', backgroundColor: '#FFFFFF', borderBottom: '1px solid #EAEAEA', position: 'sticky', top: 0, zIndex: 100, flexWrap: 'wrap', gap: '15px' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { height: '32px', width: '32px', borderRadius: '4px', objectFit: 'contain' },
  title: { margin: 0, fontSize: '1.2rem', color: '#111', letterSpacing: '-0.5px', fontWeight: '700' },
  
  searchContainer: { flex: '1 1 250px', maxWidth: '500px', display: 'flex' },
  searchInput: { width: '100%', padding: '10px 18px', borderRadius: '25px', border: '1px solid #EAEAEA', backgroundColor: '#FAFAFA', outline: 'none', fontSize: '0.9rem', color: '#111', transition: 'border-color 0.2s' },
  
  controls: { display: 'flex', gap: '16px', alignItems: 'center' },
  
  /* Both icons now share this exact same style */
  iconButton: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', color: '#111', transition: 'color 0.2s' },
  badge: { position: 'absolute', top: '-4px', right: '-6px', backgroundColor: '#111', color: '#FFF', borderRadius: '50%', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }
};

export default Navbar;