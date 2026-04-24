import { useState, useEffect } from 'react';
import { collection, getDocs, query, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const ShopGallery = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  
  // ✨ NEW: Pagination States
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  const { addToCart, getTierDetails, cart, updateQuantity, removeFromCart } = useCart(); 
  const { searchQuery } = useAuth(); 

  // ✨ NEW: Initial Fetch (Only grabs the first 24 products)
  useEffect(() => {
    const fetchInitialProducts = async () => {
      try {
        const q = query(collection(db, 'products'), limit(24));
        const snapshot = await getDocs(q);
        
        const fetchedProducts = snapshot.docs.map(doc => ({
          id: doc.id, 
          title: doc.data().name || doc.data().title || "",             
          price: doc.data().retail,           
          image: doc.data().imageUrl, 
          images: doc.data().images,  
          wholesalePrice: doc.data().ws || doc.data().wholesalePrice,      
          bulkPrice: doc.data().bulk || doc.data().bulkPrice,
          moq: doc.data().moq,
          packSize: doc.data().packSize,
          desc: doc.data().desc || "No description provided.",
          tags: doc.data().cat ? doc.data().cat.split(',').map(t => t.trim()) : [] 
        }));

        setInventory(fetchedProducts);
        
        // Save the bookmark for the next batch
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        // If we got exactly 24, there might be more. If less, we hit the end.
        setHasMore(snapshot.docs.length === 24); 

      } catch (error) {
        console.error("Error fetching products: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialProducts();
  }, []);

  // ✨ NEW: Load More Function (Grabs the next 24)
  const loadMoreProducts = async () => {
    if (!lastDoc) return;
    setLoadingMore(true);
    
    try {
      const q = query(collection(db, 'products'), startAfter(lastDoc), limit(24));
      const snapshot = await getDocs(q);
      
      const fetchedProducts = snapshot.docs.map(doc => ({
        id: doc.id, 
        title: doc.data().name || doc.data().title || "",             
        price: doc.data().retail,           
        image: doc.data().imageUrl, 
        images: doc.data().images,  
        wholesalePrice: doc.data().ws || doc.data().wholesalePrice,      
        bulkPrice: doc.data().bulk || doc.data().bulkPrice,
        moq: doc.data().moq,
        packSize: doc.data().packSize,
        desc: doc.data().desc || "No description provided.",
        tags: doc.data().cat ? doc.data().cat.split(',').map(t => t.trim()) : [] 
      }));

      // Append new products to existing inventory
      setInventory(prev => [...prev, ...fetchedProducts]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 24);

    } catch (error) {
      console.error("Error loading more: ", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Client-side search (Filters the currently loaded chunks)
  const filteredInventory = inventory.filter((product) => {
    const q = (searchQuery || "").toLowerCase();
    if (!q) return true; 
    
    const safeTitle = (product.title || "").toLowerCase();
    const matchesTitle = safeTitle.includes(q);
    const matchesTags = (product.tags || []).some(tag => 
      (tag || "").toLowerCase().includes(q)
    );
    
    return matchesTitle || matchesTags;
  });

  if (loading) return <div style={styles.emptyState}>Loading Catalogue...</div>;

  return (
    <div style={{ paddingBottom: '40px' }}>
      {filteredInventory.length === 0 ? (
        <div style={styles.emptyState}>No products found matching "{searchQuery}"</div>
      ) : (
        <>
          <div style={styles.grid}>
            {filteredInventory.map((product) => (
              <ProductCard key={product.id} productData={product} onOpenModal={setSelectedProduct} />
            ))}
          </div>

          {/* ✨ NEW: The Load More Button */}
          {hasMore && !searchQuery && (
            <div style={styles.loadMoreContainer}>
              <button 
                onClick={loadMoreProducts} 
                style={styles.loadMoreBtn} 
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Products'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Code remains exactly the same! */}
      {selectedProduct && (
        <div style={styles.modalOverlay} onClick={() => { setSelectedProduct(null); setIsZoomed(false); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => { setSelectedProduct(null); setIsZoomed(false); }}>✕</button>
            
            <div style={styles.modalBody}>
              <div style={styles.leftColumn}>
                <div style={styles.modalImageSection}>
                   <div style={styles.scroller}>
                      {(selectedProduct.images || (selectedProduct.image ? [selectedProduct.image] : [])).map((imgUrl, idx) => (
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
                  <h3 style={styles.modalPrice}>₹{getTierDetails(selectedProduct).price} <span style={styles.unit}>/ pc</span></h3>
                </div>
                
                <div style={styles.tagsBox}>
                  {(selectedProduct.tags || []).map((tag, i) => (
                    <span key={i} style={styles.tag}>#{tag}</span>
                  ))}
                </div>

                <div style={styles.descBox}>
                  <p style={styles.descText}>{selectedProduct.desc}</p>
                </div>
                
                <div style={styles.moqRow}>
                  <span>Min. Order: {getTierDetails(selectedProduct).moq || 1}</span>
                  <span>Pack Size: {selectedProduct.packSize || 1}</span>
                </div>

                {(() => {
                  const itemInCart = cart.find(item => item.id === selectedProduct.id);
                  const moq = getTierDetails(selectedProduct).moq || 1;
                  const packSize = selectedProduct.packSize || 1;
                  const minQty = Math.max(moq, packSize); 

                  if (itemInCart) {
                    return (
                      <div style={styles.amazonPill}>
                        <button 
                          onClick={() => {
                            const newQty = itemInCart.quantity - packSize;
                            if (newQty < minQty) removeFromCart(itemInCart.id);
                            else updateQuantity(itemInCart.id, newQty);
                          }}
                          style={styles.pillBtn}
                        >
                          {itemInCart.quantity - packSize < minQty ? '🗑️' : '−'}
                        </button>
                        <span style={styles.pillQty}>{itemInCart.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(itemInCart.id, itemInCart.quantity + packSize)}
                          style={styles.pillBtn}
                        >
                          +
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <button style={styles.modalAddButton} onClick={() => addToCart(selectedProduct, minQty)}>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' },
  
  /* ✨ NEW: Load More Button Styles */
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