import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { totalItems } = useCart();
  const { currentUser, userTier, searchQuery, setSearchQuery, presentationMode, setPresentationMode } = useAuth();
  
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isStaffOrAdmin = ['admin', 'management', 'staff'].includes(userTier);

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
        
        {/* ✨ FIXED: Removed 'position: relative' from this wrapper so the dropdown anchors to the main controls group instead! */}
        {isStaffOrAdmin && (
          <div ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              style={{ ...styles.iconButton, color: presentationMode !== 'all' ? '#D4AF37' : '#111' }} 
              aria-label="Pricing Mode" 
              title="Toggle Pricing Visibility"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div style={styles.dropdownMenu}>
                <div style={styles.dropdownHeader}>Pricing View</div>
                <button 
                  style={{ ...styles.dropdownItem, ...(presentationMode === 'all' ? styles.activeItem : {}) }} 
                  onClick={() => { setPresentationMode('all'); setShowMenu(false); }}
                >
                  Show All Prices
                </button>
                <button 
                  style={{ ...styles.dropdownItem, ...(presentationMode === 'retail' ? styles.activeItem : {}) }} 
                  onClick={() => { setPresentationMode('retail'); setShowMenu(false); }}
                >
                  Retail Only
                </button>
                <button 
                  style={{ ...styles.dropdownItem, ...(presentationMode === 'wholesale' ? styles.activeItem : {}) }} 
                  onClick={() => { setPresentationMode('wholesale'); setShowMenu(false); }}
                >
                  Wholesale Only
                </button>
                <button 
                  style={{ ...styles.dropdownItem, ...(presentationMode === 'bulk' ? styles.activeItem : {}) }} 
                  onClick={() => { setPresentationMode('bulk'); setShowMenu(false); }}
                >
                  Bulk Only
                </button>
              </div>
            )}
          </div>
        )}

        {/* ADMIN STEALTH LINK */}
        {userTier === 'admin' && (
          <Link to="/garv-secure-admin" style={styles.iconButton} aria-label="Control Center" title="Control Center">
            <svg width="24" height="24" fill="none" stroke="#D4AF37" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        )}

        {/* Seamless User Icon */}
        <Link to={currentUser ? "/profile" : "/login"} style={styles.iconButton} aria-label="User Profile">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        </Link>

        {/* Existing Cart Icon */}
        <Link to="/cart" style={styles.iconButton} aria-label="Shopping Cart">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
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
  
  // ✨ FIXED: Added 'position: relative' to the parent controls flexbox.
  controls: { display: 'flex', gap: '16px', alignItems: 'center', position: 'relative' },
  
  iconButton: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' },
  badge: { position: 'absolute', top: '-4px', right: '-6px', backgroundColor: '#111', color: '#FFF', borderRadius: '50%', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' },

  // ✨ FIXED: Now anchored to 'right: 0' of the entire control group, so it perfectly aligns with the Shopping Cart icon edge!
  dropdownMenu: { position: 'absolute', top: '100%', right: '-4px', marginTop: '16px', backgroundColor: '#FFF', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', border: '1px solid #EAEAEA', overflow: 'hidden', minWidth: '170px', zIndex: 1000 },
  dropdownHeader: { padding: '10px 14px', fontSize: '0.7rem', fontWeight: '800', color: '#888', textTransform: 'uppercase', borderBottom: '1px solid #EAEAEA', backgroundColor: '#FAFAFA', letterSpacing: '0.5px' },
  dropdownItem: { display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', fontSize: '0.85rem', fontWeight: '600', color: '#111', background: 'none', border: 'none', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', transition: 'background 0.2s' },
  activeItem: { color: '#D4AF37', backgroundColor: '#FFFAF0' }
};

export default Navbar;