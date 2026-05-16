import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const ShopGallery = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeVariant, setActiveVariant] = useState(null);
  
  const [isZoomed, setIsZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  
  const [visibleCount, setVisibleCount] = useState(24); 
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isFading, setIsFading] = useState(false);
  
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : true);
  const [viewMode, setViewMode] = useState(2); 
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  
  const { addToCart, getTierDetails, cart, updateQuantity, removeFromCart } = useCart(); 
  const { searchQuery, userTier, presentationMode } = useAuth(); 

  const isInternalTeam = ['admin', 'staff', 'management'].includes(userTier);
  const showCartonInfo = ['admin', 'staff', 'management', 'bulk'].includes(userTier);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const scroller = document.getElementById('modal-image-scroller');
    if (scroller) scroller.scrollLeft = 0;
    setIsZoomed(false); 
  }, [activeVariant]);

  useEffect(() => {
    setActiveVariant(null);
    setIsZoomed(false);
    setPan({x:0, y:0});
  }, [selectedProduct]);

  useEffect(() => {
    setVisibleCount(24);
  }, [searchQuery, selectedCategory, sortOrder]);

  useEffect(() => {
    const fetchAllProductsAndSettings = async () => {
      // ✨ BULLETPROOF FIX: Isolate the settings fetch so it NEVER crashes the gallery
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        if (settingsSnap.exists()) {
          setHideOutOfStock(settingsSnap.data().hideOutOfStock || false);
        }
      } catch (settingsError) {
        console.warn("Could not fetch Master Switch settings. Defaulting to false.", settingsError);
      }

      // Proceed to fetch products regardless of settings outcome
      try {
        const q = query(collection(db, 'products'));
        const snapshot = await getDocs(q);
        
        const fetchedProducts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id, title: data.name || data.title || "", price: data.retail, image: data.imageUrl, images: data.images, stock: data.stock || 0, ws: data.ws || data.wholesalePrice, bulk: data.bulk || data.bulkPrice, moq: data.moq, retailMoq: data.retailMoq, wsMoq: data.wsMoq, bulkMoq: data.bulkMoq, packSize: data.packSize, cartonSize: data.cartonSize || null, desc: data.desc || "No description provided.", category: data.category || data.cat || '', tags: data.tags || [], variants: data.variants || [], variantLabel: data.variantLabel || 'Options', createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0 
          };
        });
        setInventory(fetchedProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProductsAndSettings();
  }, []);

  const uniqueCategories = useMemo(() => {
    const allCats = inventory.map(p => p.category);
    return ['All', ...new Set(allCats.filter(cat => cat && cat.trim() !== ''))];
  }, [inventory]);

  useEffect(() => {
    setIsFading(true);
    const timer = setTimeout(() => setIsFading(false), 250);
    return () => clearTimeout(timer);
  }, [selectedCategory, sortOrder, searchQuery, viewMode, isMobile]);

  const handlePointerDown = (e) => {
    if (!isZoomed) return;
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartPan({ x: clientX - pan.x, y: clientY - pan.y });
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !isZoomed) return;
    e.preventDefault(); 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPan({ x: clientX - startPan.x, y: clientY - startPan.y });
  };

  const handlePointerUp = () => setIsDragging(false);

  const processedInventory = useMemo(() => {
    let filtered = inventory.filter((product) => {
      // THE MASTER SWITCH LOGIC
      if (hideOutOfStock && !isInternalTeam && product.stock <= 0) {
        return false;
      }

      const q = (searchQuery || "").toLowerCase();
      const matchesSearch = !q || (product.title || "").toLowerCase().includes(q) || (product.category || "").toLowerCase().includes(q) || (product.tags || []).some(t => t.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      const aInStock = a.stock > 0 ? 1 : 0;
      const bInStock = b.stock > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock; 
      const aHasImg = (a.images && a.images.length > 0) || a.image ? 1 : 0;
      const bHasImg = (b.images && b.images.length > 0) || b.image ? 1 : 0;
      if (aHasImg !== bHasImg) return bHasImg - aHasImg;
      if (sortOrder === 'priceAsc') return a.price - b.price;
      if (sortOrder === 'priceDesc') return b.price - a.price;
      if (sortOrder === 'nameAsc') return a.title.localeCompare(b.title);
      return b.createdAt - a.createdAt;
    });
  }, [inventory, searchQuery, selectedCategory, sortOrder, hideOutOfStock, isInternalTeam]);

  const getGridStyle = () => {
    if (!isMobile) return { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', padding: '0 5%' };
    if (viewMode === 1) return { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', padding: '0 16px' };
    if (viewMode === 2) return { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '0 16px' };
    if (viewMode === 3) return { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '0 16px' };
  };

  const modalImages = useMemo(() => {
    if (!selectedProduct) return [];
    let base = selectedProduct.images?.length > 0 ? selectedProduct.images : (selectedProduct.image ? [selectedProduct.image] : []);
    if (base.length === 0 && selectedProduct.variants?.length > 0) {
      base = selectedProduct.variants.map(v => v.image).filter(Boolean);
    }
    if (activeVariant && activeVariant.image) {
      const others = base.filter(img => img !== activeVariant.image);
      return [activeVariant.image, ...others];
    }
    return base;
  }, [selectedProduct, activeVariant]);


  if (loading) return <div style={styles.emptyState}>Loading Catalogue...</div>;

  return (
    <div style={{ paddingBottom: '40px', position: 'relative' }}>
      
      <div style={styles.stickyControlBar}>
        {isMobile && (
          <div style={styles.layoutToggles}>
            <button onClick={() => setViewMode(1)} style={viewMode === 1 ? styles.iconActive : styles.iconInactive}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={() => setViewMode(2)} style={viewMode === 2 ? styles.iconActive : styles.iconInactive}>
               <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={() => setViewMode(3)} style={viewMode === 3 ? styles.iconActive : styles.iconInactive}>
               <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 4h4v4H3zM10 4h4v4h-4zM17 4h4v4h-4zM3 10h4v4H3zM10 10h4v4h-4zM17 10h4v4h-4zM3 16h4v4H3zM10 16h4v4h-4zM17 16h4v4h-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}

        <div style={styles.tagScroller} className="hide-scrollbar">
          {uniqueCategories.slice(0, isMobile ? 3 : 6).map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ ...styles.pill, ...(selectedCategory === cat ? styles.pillActive : styles.pillInactive) }}>
              {cat}
            </button>
          ))}
        </div>

        <button onClick={() => setIsFilterSheetOpen(true)} style={styles.filterBtn}>
           <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
           <span style={{fontWeight: '700', fontSize: '0.8rem'}}>Filter</span>
        </button>
      </div>

      {processedInventory.length === 0 ? (
        <div style={styles.emptyState}>No products found.</div>
      ) : (
        <>
          <div style={{ ...getGridStyle(), opacity: isFading ? 0 : 1, transform: isFading ? 'translateY(10px)' : 'translateY(0)', transition: 'opacity 0.25s ease-out, transform 0.25s ease-out' }}>
            {processedInventory.slice(0, visibleCount).map((product) => (
              <ProductCard key={product.id} productData={product} onOpenModal={setSelectedProduct} viewMode={isMobile ? viewMode : 2} presentationMode={presentationMode} />
            ))}
          </div>
          {visibleCount < processedInventory.length && (
            <div style={styles.loadMoreContainer}>
              <button onClick={() => setVisibleCount(prev => prev + 24)} style={styles.loadMoreBtn}>Load More Products</button>
            </div>
          )}
        </>
      )}

      {isFilterSheetOpen && (
        <div style={styles.sheetOverlay} onClick={() => setIsFilterSheetOpen(false)}>
          <div style={styles.sheetContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHeader}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Filters & Sort</h3>
              <button onClick={() => setIsFilterSheetOpen(false)} style={styles.sheetCloseBtn}>✕</button>
            </div>

            <div style={styles.sheetBody}>
              <p style={styles.sheetLabel}>Sort Products By</p>
              <div style={styles.sheetGrid}>
                {['newest', 'nameAsc', 'priceAsc', 'priceDesc'].map((opt) => (
                  <button key={opt} onClick={() => { setSortOrder(opt); setIsFilterSheetOpen(false); }} style={{ ...styles.sheetPill, ...(sortOrder === opt ? styles.sheetPillActive : {}) }}>
                    {opt === 'newest' ? 'Featured' : opt === 'nameAsc' ? 'A - Z' : opt === 'priceAsc' ? 'Price: Low to High' : 'Price: High to Low'}
                  </button>
                ))}
              </div>

              <p style={{ ...styles.sheetLabel, marginTop: '24px' }}>All Categories</p>
              <div style={styles.sheetGrid}>
                {uniqueCategories.map((cat) => (
                  <button key={cat} onClick={() => { setSelectedCategory(cat); setIsFilterSheetOpen(false); }} style={{ ...styles.sheetPill, ...(selectedCategory === cat ? styles.sheetPillActive : {}) }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div style={styles.modalOverlay} onClick={() => setSelectedProduct(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => setSelectedProduct(null)}>✕</button>
            
            <div style={styles.modalBody}>
              <div style={styles.leftColumn}>
                <div style={styles.modalImageSection}>
                   <div id="modal-image-scroller" style={styles.scroller}>
                      {modalImages.map((imgUrl, idx) => (
                        <div key={idx} style={styles.modalImageWrapper} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}>
                          <div style={{ ...styles.auraBackground, backgroundImage: `url(${imgUrl})` }} />
                          <img src={imgUrl} onClick={() => { if (isZoomed) { setIsZoomed(false); setPan({x:0, y:0}); } else { setIsZoomed(true); } }} style={{ ...styles.modalImage, transform: isZoomed ? `scale(2) translate(${pan.x/2}px, ${pan.y/2}px)` : 'scale(1)', cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }} alt={`View ${idx}`} draggable="false" />
                        </div>
                      ))}
                   </div>
                </div>
                {!isZoomed && <p style={styles.hint}>Swipe to view gallery</p>}
                {isZoomed && <p style={styles.hint}>Drag to pan around</p>}
              </div>

              <div style={styles.modalDetails}>
                <div>
                  <h2 style={styles.modalTitle}>
                    {selectedProduct.title || selectedProduct.name || "Unnamed"}
                    {selectedProduct.stock <= 0 && <span style={styles.outOfStockText}> (Out of Stock)</span>}
                  </h2>

                  {isInternalTeam ? (
                    <div style={styles.modalInternalPricingBox}>
                      {(presentationMode === 'all' || presentationMode === 'wholesale') && (
                        <div style={{ flex: 1 }}>
                           <span style={styles.modalInternalLabel}>Wholesale</span>
                           <h3 style={styles.modalInternalValue}>₹{activeVariant && activeVariant.ws ? activeVariant.ws : selectedProduct.ws} <span style={styles.unit}>/ pc</span></h3>
                        </div>
                      )}
                      {presentationMode === 'all' && <div style={{ width: '1px', backgroundColor: '#D1D5DB' }}></div>}
                      {(presentationMode === 'all' || presentationMode === 'bulk') && (
                        <div style={{ flex: 1, paddingLeft: presentationMode === 'all' ? '16px' : '0' }}>
                           <span style={styles.modalInternalLabel}>Bulk</span>
                           <h3 style={styles.modalInternalValue}>₹{activeVariant && activeVariant.bulk ? activeVariant.bulk : selectedProduct.bulk} <span style={styles.unit}>/ pc</span></h3>
                        </div>
                      )}
                      {presentationMode === 'retail' && (
                        <div style={{ flex: 1 }}>
                           <span style={styles.modalInternalLabel}>Retail</span>
                           <h3 style={styles.modalInternalValue}>₹{activeVariant && activeVariant.retail ? activeVariant.retail : selectedProduct.price} <span style={styles.unit}>/ pc</span></h3>
                        </div>
                      )}
                    </div>
                  ) : (
                    <h3 style={styles.modalPrice}>₹{getTierDetails(selectedProduct, activeVariant).price} <span style={styles.unit}>/ pc</span></h3>
                  )}
                </div>
                
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div style={styles.variantContainer}>
                    <p style={styles.variantLabel}>Select {selectedProduct.variantLabel}:</p>
                    <div style={styles.variantGrid}>
                      {selectedProduct.variants.map((variant, idx) => (
                        <button key={idx} onClick={() => setActiveVariant(variant)} style={{ ...styles.variantPill, ...(activeVariant?.name === variant.name ? styles.variantPillActive : styles.variantPillInactive) }}>
                          {variant.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.tagsBox}>
                  {selectedProduct.category && <span style={{...styles.tag, borderColor:'#D4AF37', color:'#D4AF37', fontWeight:600}}>{selectedProduct.category}</span>}
                  {(selectedProduct.tags || []).map((tag, i) => <span key={i} style={styles.tag}>#{tag}</span>)}
                </div>

                <div style={styles.descBox}><p style={styles.descText}>{selectedProduct.desc}</p></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid #EAEAEA', paddingBottom: '12px' }}>
                  <div style={styles.moqRow}>
                    <span>Min. Order: {getTierDetails(selectedProduct, activeVariant).moq || 1}</span>
                    <span>Pack Size: {getTierDetails(selectedProduct, activeVariant).step || 1}</span>
                  </div>
                  {showCartonInfo && selectedProduct.cartonSize && (
                    <div style={styles.modalCartonBadge}><span>📦 Master Carton Size</span><b>{selectedProduct.cartonSize} pcs</b></div>
                  )}
                </div>

                {(() => {
                  if (selectedProduct.stock <= 0) return <button style={{...styles.modalAddButton, opacity:0.5, cursor:'not-allowed'}} disabled>Out of Stock</button>;

                  const hasVariants = selectedProduct.variants && selectedProduct.variants.length > 0;
                  if (hasVariants && !activeVariant) return <button style={{...styles.modalAddButton, opacity: 0.5, cursor: 'not-allowed'}} disabled>Select an Option</button>;

                  const cartItemId = hasVariants ? `${selectedProduct.id}-${activeVariant.name}` : selectedProduct.id;
                  const itemInCart = cart.find(item => item.cartItemId === cartItemId);
                  const tierInfo = getTierDetails(selectedProduct, activeVariant);
                  const minQty = Math.max(tierInfo.moq || 1, tierInfo.step); 

                  if (itemInCart) {
                    return (
                      <div style={styles.amazonPill}>
                        <button onClick={(e) => { 
                          e.stopPropagation();
                          const newQty = itemInCart.quantity - tierInfo.step; 
                          if (newQty < minQty) removeFromCart(itemInCart.cartItemId); 
                          else updateQuantity(itemInCart.cartItemId, newQty); 
                        }} style={styles.pillBtn}>
                          {itemInCart.quantity - tierInfo.step < minQty ? '🗑️' : '−'}
                        </button>
                        <span style={styles.pillQty}>{itemInCart.quantity}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateQuantity(itemInCart.cartItemId, itemInCart.quantity + tierInfo.step) }} style={styles.pillBtn}>+</button>
                      </div>
                    );
                  } else {
                    return <button style={styles.modalAddButton} onClick={(e) => { e.stopPropagation(); addToCart(selectedProduct, minQty, activeVariant)}}>Add to Cart</button>;
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
  stickyControlBar: { position: 'sticky', top: '16px', zIndex: 40, backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(212, 175, 55, 0.4)', borderRadius: '50px', padding: '6px 12px', margin: '0 16px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' },
  layoutToggles: { display: 'flex', gap: '4px' },
  iconActive: { background: '#111', color: '#FFF', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  iconInactive: { background: 'transparent', color: '#888', border: 'none', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  tagScroller: { display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', flex: '1 1 auto', alignItems: 'center' },
  pill: { padding: '8px 16px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '0.5px' },
  pillActive: { backgroundColor: '#F9F8F6', color: '#D4AF37', border: '1px solid #D4AF37' },
  pillInactive: { backgroundColor: 'transparent', color: '#888', border: '1px solid transparent' },
  filterBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: '#F9F8F6', border: '1px solid #EAEAEA', color: '#111', padding: '8px 16px', borderRadius: '50px', cursor: 'pointer', flexShrink: 0 },
  loadMoreContainer: { display: 'flex', justifyContent: 'center', marginTop: '32px' },
  loadMoreBtn: { backgroundColor: '#FFF', color: '#111', border: '1px solid #EAEAEA', padding: '12px 32px', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
  sheetOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' },
  sheetContent: { backgroundColor: '#FFF', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', maxHeight: '80vh', overflowY: 'auto', animation: 'slideUp 0.3s ease-out' },
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  sheetCloseBtn: { background: '#F5F5F5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  sheetLabel: { margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sheetGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  sheetPill: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #EAEAEA', background: '#FAFAFA', color: '#111', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' },
  sheetPillActive: { borderColor: '#D4AF37', color: '#D4AF37', backgroundColor: '#FFFAF0' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modalContent: { backgroundColor: '#FFF', borderRadius: '8px', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' },
  closeButton: { position: 'absolute', top: '16px', right: '16px', background: '#FAFAFA', border: '1px solid #EAEAEA', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#111', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { display: 'flex', flexWrap: 'wrap', padding: '24px', gap: '24px' },
  leftColumn: { flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '8px' },
  modalImageSection: { backgroundColor: '#FAFAFA', borderRadius: '6px', overflow: 'hidden', position: 'relative', width: '100%', border: '1px solid #EAEAEA' },
  scroller: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '300px', scrollbarWidth: 'none', touchAction: 'pan-y', scrollBehavior: 'smooth' },
  modalImageWrapper: { flex: '0 0 100%', width: '100%', height: '100%', position: 'relative', scrollSnapAlign: 'start', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', userSelect: 'none' },
  auraBackground: { position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(15px)', opacity: 0.3, zIndex: 0 },
  modalImage: { width: '85%', height: '85%', objectFit: 'contain', zIndex: 1, position: 'relative', transition: 'transform 0.1s ease-out', borderRadius: '4px' },
  hint: { textAlign: 'center', fontSize: '0.75rem', color: '#888', margin: 0 },
  modalDetails: { flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalTitle: { margin: 0, color: '#111', fontSize: '1.25rem', fontWeight: '600' },
  outOfStockText: { color: 'red', fontSize: '1rem', fontWeight: '700' },
  modalPrice: { margin: '4px 0 0 0', color: '#111', fontSize: '1.4rem', fontWeight: '700' },
  unit: { fontSize: '0.85rem', color: '#666', fontWeight: '400' },
  modalInternalPricingBox: { display: 'flex', gap: '16px', marginTop: '8px', backgroundColor: '#F9F8F6', padding: '12px', borderRadius: '6px', border: '1px solid #EAEAEA' },
  modalInternalLabel: { fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', fontWeight: '700' },
  modalInternalValue: { margin: '4px 0 0 0', color: '#111', fontSize: '1.25rem', fontWeight: '700' },
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
  moqRow: { display: 'flex', justifyContent: 'space-between', color: '#111', fontWeight: '500', fontSize: '0.85rem' },
  modalCartonBadge: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFAF0', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(212, 175, 55, 0.4)', fontSize: '0.85rem', color: '#B8860B' },
  modalAddButton: { marginTop: 'auto', backgroundColor: '#111', color: '#FFF', padding: '0', border: 'none', borderRadius: '6px', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.2s', height: '42px' },
  amazonPill: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '0 8px', backgroundColor: '#FFF', marginTop: 'auto', height: '42px', boxSizing: 'border-box' },
  pillBtn: { background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#111', width: '36px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pillQty: { fontWeight: '600', fontSize: '1rem', color: '#111', minWidth: '30px', textAlign: 'center' },
  emptyState: { textAlign: 'center', padding: '10vh', color: '#666', fontSize: '0.9rem' }
};

export default ShopGallery;