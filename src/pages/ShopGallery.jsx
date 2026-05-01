import React, { useState, useEffect, useMemo } from 'react';
// ✨ FIXED: Removed orderBy from import as we will handle it client-side
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const ShopGallery = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Variant States
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [activeVariant, setActiveVariant] = useState(null);
  
  // UI Pagination State
  const [visibleCount, setVisibleCount] = useState(24); 
  
  // Filter & Sort States
  const [selectedTag, setSelectedTag] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isFading, setIsFading] = useState(false);
  
  const { addToCart, getTierDetails, cart, updateQuantity, removeFromCart } = useCart(); 
  const { searchQuery } = useAuth(); 

  // Reset variant when modal closes or opens a new product
  useEffect(() => {
    setActiveVariant(null);
  }, [selectedProduct]);

  useEffect(() => {
    setVisibleCount(24);
  }, [searchQuery, selectedTag, sortOrder]);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        // ✨ FIXED: Removed orderBy so Firebase doesn't hide older products missing the createdAt field
        const q = query(collection(db, 'products'));
        const snapshot = await getDocs(q);
        
        const fetchedProducts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id, 
            title: data.name || data.title || "",             
            price: data.retail,           
            image: data.imageUrl, 
            images: data.images,  
            wholesalePrice: data.ws || data.wholesalePrice,      
            bulkPrice: data.bulk || data.bulkPrice,
            moq: data.moq,
            packSize: data.packSize,
            desc: data.desc || "No description provided.",
            tags: data.cat ? data.cat.split(',').map(t => t.trim()) : [],
            variants: data.variants || [],
            variantLabel: data.variantLabel || 'Options',
            // ✨ FIXED: Safely grab createdAt, fallback to 0 for old products
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0 
          };
        });

        setInventory(fetchedProducts);
      } catch (error) {
        console.error("Error fetching products: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  const uniqueTags = useMemo(() => {
    const allTags = inventory.flatMap(p => p.tags || []);
    const validTags = allTags.filter(tag => tag && tag.trim() !== '');
    return ['All', ...new Set(validTags)];
  }, [inventory]);

  useEffect(() => {
    setIsFading(true);
    const timer = setTimeout(() => setIsFading(false), 250);
    return () => clearTimeout(timer);
  }, [selectedTag, sortOrder, searchQuery]);

  const processedInventory = useMemo(() => {
    let filtered = inventory.filter((product) => {
      const q = (searchQuery || "").toLowerCase();
      const matchesSearch = !q || 
        (product.title || "").toLowerCase().includes(q) || 
        (product.tags || []).some(t => t.toLowerCase().includes(q));
      
      const matchesTag = selectedTag === 'All' || (product.tags || []).includes(selectedTag);

      return matchesSearch && matchesTag;
    });

    return filtered.sort((a, b) => {
      if (sortOrder === 'priceAsc') return a.price - b.price;
      if (sortOrder === 'priceDesc') return b.price - a.price;
      if (sortOrder === 'nameAsc') return a.title.localeCompare(b.title);
      // ✨ FIXED: Client-side "Newest" sorting. New items at top, old items at bottom.
      return b.createdAt - a.createdAt; 
    });
  }, [inventory, searchQuery, selectedTag, sortOrder]);


  if (loading) return <div style={styles.emptyState}>Loading Catalogue...</div>;

  return (
    <div style={{ paddingBottom: '40px', position: 'relative' }}>
      
      {/* Sticky Control Bar */}
      <div style={styles.stickyControlBar}>
        <div style={styles.tagScroller} className="hide-scrollbar">
          {uniqueTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                ...styles.pill,
                ...(selectedTag === tag ? styles.pillActive : styles.pillInactive)
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        <div style={styles.sortContainer}>
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            style={styles.sortSelect}
          >
            <option value="newest">Featured</option>
            <option value="nameAsc">A - Z</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {processedInventory.length === 0 ? (
        <div style={styles.emptyState}>No products found.</div>
      ) : (
        <>
          <div style={{
            ...styles.grid, 
            opacity: isFading ? 0 : 1, 
            transform: isFading ? 'translateY(10px)' : 'translateY(0)',
            transition: 'opacity 0.25s ease-out, transform 0.25s ease-out' 
          }}>
            {processedInventory.slice(0, visibleCount).map((product) => (
              <ProductCard key={product.id} productData={product} onOpenModal={setSelectedProduct} />
            ))}
          </div>

          {visibleCount < processedInventory.length && (
            <div style={styles.loadMoreContainer}>
              <button onClick={() => setVisibleCount(prev => prev + 24)} style={styles.loadMoreBtn}>
                Load More Products
              </button>
            </div>
          )}
        </>
      )}

      {/* PRODUCT MODAL */}
      {selectedProduct && (
        <div style={styles.modalOverlay} onClick={() => { setSelectedProduct(null); setIsZoomed(false); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => { setSelectedProduct(null); setIsZoomed(false); }}>✕</button>
            
            <div style={styles.modalBody}>
              <div style={styles.leftColumn}>
                <div style={styles.modalImageSection}>
                   <div style={styles.scroller}>
                      {(selectedProduct.images && selectedProduct.images.length > 0 
                          ? selectedProduct.images 
                          : (selectedProduct.image ? [selectedProduct.image] : [])
                      ).map((imgUrl, idx) => (
                        <div key={idx} style={styles.modalImageWrapper}>
                          <div style={{ ...styles.auraBackground, backgroundImage: `url(${imgUrl})` }} />
                          <img 
                            src={imgUrl} 
                            onClick={() => setIsZoomed(!isZoomed)}
                            style={{ ...styles.modalImage, transform: isZoomed ? 'scale(1.8)' : 'scale(1)', cursor: isZoomed ? 'zoom-out' : 'zoom-in' }} 
                            alt={`View ${idx}`} 
                          />
                        </div>
                      ))}
                   </div>
                </div>
                {!isZoomed && <p style={styles.hint}>Swipe to view gallery</p>}
              </div>

              <div style={styles.modalDetails}>
                <div>
                  <h2 style={styles.modalTitle}>{selectedProduct.title || "Unnamed Product"}</h2>
                  <h3 style={styles.modalPrice}>
                    ₹{getTierDetails(selectedProduct, activeVariant).price} 
                    <span style={styles.unit}>/ pc</span>
                  </h3>
                </div>
                
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div style={styles.variantContainer}>
                    <p style={styles.variantLabel}>Select {selectedProduct.variantLabel}:</p>
                    <div style={styles.variantGrid}>
                      {selectedProduct.variants.map((variant, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveVariant(variant)}
                          style={{
                            ...styles.variantPill,
                            ...(activeVariant?.name === variant.name ? styles.variantPillActive : styles.variantPillInactive)
                          }}
                        >
                          {variant.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.tagsBox}>
                  {(selectedProduct.tags || []).map((tag, i) => (
                    <span key={i} style={styles.tag}>#{tag}</span>
                  ))}
                </div>

                <div style={styles.descBox}>
                  <p style={styles.descText}>{selectedProduct.desc}</p>
                </div>
                
                <div style={styles.moqRow}>
                  <span>Min. Order: {getTierDetails(selectedProduct, activeVariant).moq || 1}</span>
                  <span>Pack Size: {selectedProduct.packSize || 1}</span>
                </div>

                {(() => {
                  const hasVariants = selectedProduct.variants && selectedProduct.variants.length > 0;
                  if (hasVariants && !activeVariant) {
                    return (
                      <button style={{...styles.modalAddButton, opacity: 0.5, cursor: 'not-allowed'}} disabled>
                        Select an Option
                      </button>
                    );
                  }

                  const cartItemId = hasVariants ? `${selectedProduct.id}-${activeVariant.name}` : selectedProduct.id;
                  const itemInCart = cart.find(item => item.cartItemId === cartItemId);
                  
                  const tierInfo = getTierDetails(selectedProduct, activeVariant);
                  const minQty = Math.max(tierInfo.moq || 1, selectedProduct.packSize || 1); 

                  if (itemInCart) {
                    return (
                      <div style={styles.amazonPill}>
                        <button 
                          onClick={() => {
                            const newQty = itemInCart.quantity - (selectedProduct.packSize || 1);
                            if (newQty < minQty) removeFromCart(itemInCart.cartItemId);
                            else updateQuantity(itemInCart.cartItemId, newQty);
                          }}
                          style={styles.pillBtn}
                        >
                          {itemInCart.quantity - (selectedProduct.packSize || 1) < minQty ? '🗑️' : '−'}
                        </button>
                        <span style={styles.pillQty}>{itemInCart.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(itemInCart.cartItemId, itemInCart.quantity + (selectedProduct.packSize || 1))}
                          style={styles.pillBtn}
                        >
                          +
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <button style={styles.modalAddButton} onClick={() => addToCart(selectedProduct, minQty, activeVariant)}>
                        Add to Cart
                      </button>
                    );
                  }
                })()}

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  stickyControlBar: {
    position: 'sticky', top: '16px', zIndex: 40, backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(212, 175, 55, 0.4)',
    borderRadius: '50px', padding: '8px 16px', margin: '0 16px 24px 16px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', gap: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)'
  },
  tagScroller: { display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', flex: '1 1 auto', alignItems: 'center' },
  pill: { padding: '8px 20px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '0.5px' },
  pillActive: { backgroundColor: '#D4AF37', color: '#FFF', border: '1px solid #D4AF37', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)' },
  pillInactive: { backgroundColor: 'transparent', color: '#666', border: '1px solid transparent' },
  sortContainer: { flex: '0 0 auto' },
  sortSelect: { padding: '8px 16px', borderRadius: '50px', border: '1px solid #EAEAEA', backgroundColor: '#F9F8F6', fontSize: '0.8rem', fontWeight: '600', color: '#111', cursor: 'pointer', outline: 'none' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', padding: '0 16px' },
  loadMoreContainer: { display: 'flex', justifyContent: 'center', marginTop: '32px' },
  loadMoreBtn: { backgroundColor: '#FFF', color: '#111', border: '1px solid #EAEAEA', padding: '12px 32px', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modalContent: { backgroundColor: '#FFF', borderRadius: '8px', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' },
  closeButton: { position: 'absolute', top: '16px', right: '16px', background: '#FAFAFA', border: '1px solid #EAEAEA', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#111', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { display: 'flex', flexWrap: 'wrap', padding: '24px', gap: '24px' },
  
  leftColumn: { flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '8px' },
  modalImageSection: { backgroundColor: '#FAFAFA', borderRadius: '6px', overflow: 'hidden', position: 'relative', width: '100%', border: '1px solid #EAEAEA' },
  scroller: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '300px', scrollbarWidth: 'none' },
  modalImageWrapper: { flex: '0 0 100%', width: '100%', height: '100%', position: 'relative', scrollSnapAlign: 'start', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  auraBackground: { position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(15px)', opacity: 0.3, zIndex: 0 },
  modalImage: { width: '85%', height: '85%', objectFit: 'contain', zIndex: 1, position: 'relative', transition: 'transform 0.2s ease', borderRadius: '4px' },
  hint: { textAlign: 'center', fontSize: '0.75rem', color: '#888', margin: 0 },
  
  modalDetails: { flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalTitle: { margin: 0, color: '#111', fontSize: '1.25rem', fontWeight: '600' },
  modalPrice: { margin: '4px 0 0 0', color: '#111', fontSize: '1.4rem', fontWeight: '700' },
  unit: { fontSize: '0.85rem', color: '#666', fontWeight: '400' },
  
  variantContainer: { backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '12px', borderRadius: '6px' },
  variantLabel: { margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: '700', color: '#666', textTransform: 'uppercase' },
  variantGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  variantPill: { padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s border' },
  variantPillActive: { backgroundColor: '#F9F8F6', color: '#D4AF37', border: '2px solid #D4AF37' },
  variantPillInactive: { backgroundColor: '#FAFAFA', color: '#444', border: '1px solid #EAEAEA' },

  tagsBox: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  tag: { backgroundColor: '#FAFAFA', border: '1px solid #EAEAEA', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', color: '#444' },
  
  descBox: { backgroundColor: '#FAFAFA', padding: '12px', borderRadius: '6px', border: '1px solid #F3F4F6' },
  descText: { margin: 0, lineHeight: '1.5', color: '#444', fontSize: '0.85rem' },
  
  moqRow: { display: 'flex', justifyContent: 'space-between', color: '#111', fontWeight: '500', fontSize: '0.85rem', borderBottom: '1px solid #EAEAEA', paddingBottom: '12px' },
  
  modalAddButton: { marginTop: 'auto', backgroundColor: '#111', color: '#FFF', padding: '0', border: 'none', borderRadius: '6px', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.2s', height: '42px' },
  
  amazonPill: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '0 8px', backgroundColor: '#FFF', marginTop: 'auto', height: '42px', boxSizing: 'border-box' },
  pillBtn: { background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#111', width: '36px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pillQty: { fontWeight: '600', fontSize: '1rem', color: '#111', minWidth: '30px', textAlign: 'center' },
  
  emptyState: { textAlign: 'center', padding: '10vh', color: '#666', fontSize: '0.9rem' }
};

export default ShopGallery;
