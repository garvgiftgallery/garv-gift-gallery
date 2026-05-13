import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const ProductCard = ({ productData, onOpenModal, viewMode = 2, presentationMode = 'all' }) => {
  const { addToCart, getTierDetails, cart, updateQuantity, removeFromCart } = useCart();
  const { isPremiumTier, userTier } = useAuth();
  
  const currentPricing = getTierDetails(productData);
  const hasVariants = productData.variants && productData.variants.length > 0;
  const isOutOfStock = productData.stock <= 0;

  const isInternalTeam = ['admin', 'staff', 'management'].includes(userTier);
  const showCartonInfo = ['admin', 'staff', 'management', 'bulk'].includes(userTier);

  const isCompact = viewMode === 3;
  const dynamicImageHeight = viewMode === 1 ? '240px' : viewMode === 3 ? '120px' : '180px';

  // ✨ SMART FALLBACK: If no base images, collect all available variant images to build the gallery
  let imageArray = productData.images?.length > 0 ? productData.images : (productData.image ? [productData.image] : []);
  if (imageArray.length === 0 && hasVariants) {
    imageArray = productData.variants.map(v => v.image).filter(Boolean); 
  }

  return (
    <div style={{...styles.card, opacity: isOutOfStock ? 0.7 : 1}}>
      <div style={{...styles.imageContainer, height: dynamicImageHeight}} onClick={() => onOpenModal(productData)}>
        
        {imageArray.length === 0 ? (
          <img src="https://via.placeholder.com/400?text=No+Image" style={styles.image} alt="Placeholder" />
        ) : (
          <div style={styles.scroller}>
            {imageArray.map((imgUrl, index) => (
              <div key={index} style={styles.imageWrapper}>
                <div style={{ ...styles.auraBackground, backgroundImage: `url(${imgUrl})` }} />
                <img src={imgUrl} alt={`View ${index + 1}`} style={styles.image} />
              </div>
            ))}
          </div>
        )}
        
        {isOutOfStock && <div style={isCompact ? styles.outOfStockBadgeCompact : styles.outOfStockBadge}>OUT OF STOCK</div>}
        {!isOutOfStock && isPremiumTier && currentPricing.label && !isInternalTeam && !isCompact && <div style={styles.badge}>{currentPricing.label}</div>}
        {!isOutOfStock && isInternalTeam && !isCompact && <div style={{...styles.badge, backgroundColor: '#D4AF37', color: '#FFF'}}>INTERNAL</div>}
      </div>

      <div style={{...styles.info, cursor: isCompact ? 'pointer' : 'default'}} onClick={() => isCompact && onOpenModal(productData)}>
        <h3 style={{...styles.title, fontSize: isCompact ? '0.8rem' : '0.95rem'}} onClick={() => !isCompact && onOpenModal(productData)}>
          {productData.title || productData.name || "Unnamed Product"}
        </h3>
        
        {isInternalTeam ? (
          <>
            {presentationMode === 'retail' && <p style={{...styles.price, fontSize: isCompact ? '0.9rem' : '1.1rem'}}>₹{productData.price} <span style={styles.unit}>/ pc</span></p>}
            {presentationMode === 'wholesale' && <p style={{...styles.price, fontSize: isCompact ? '0.9rem' : '1.1rem'}}>₹{productData.ws} <span style={styles.unit}>/ pc (WS)</span></p>}
            {presentationMode === 'bulk' && <p style={{...styles.price, fontSize: isCompact ? '0.9rem' : '1.1rem'}}>₹{productData.bulk} <span style={styles.unit}>/ pc (Bulk)</span></p>}
            {presentationMode === 'all' && (
              <div style={styles.internalPricingBox}>
                <div style={styles.internalPriceRow}><span style={{...styles.internalLabel, fontSize: isCompact ? '0.65rem' : '0.75rem'}}>WS:</span><b style={{...styles.internalValue, fontSize: isCompact ? '0.8rem' : '1rem'}}>₹{productData.ws}</b></div>
                {!isCompact && <div style={styles.internalPriceRow}><span style={styles.internalLabel}>Bulk:</span><b style={styles.internalValue}>₹{productData.bulk}</b></div>}
              </div>
            )}
          </>
        ) : (
          <p style={{...styles.price, fontSize: isCompact ? '0.9rem' : '1.1rem'}}>₹{currentPricing.price} <span style={styles.unit}>/ pc</span></p>
        )}
        
        {!isCompact && (
          <>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={styles.moqBox}>
                <div style={styles.moqItem}><span>MOQ</span><b>{currentPricing.moq || 1}</b></div>
                <div style={styles.divider}></div>
                <div style={styles.moqItem}><span>Pack</span><b>{productData.packSize || 1}</b></div>
              </div>
              {showCartonInfo && productData.cartonSize && (
                <div style={styles.cartonBadge}><span>📦 Master Carton</span><b>{productData.cartonSize} pcs</b></div>
              )}
            </div>

            {(() => {
              if (isOutOfStock) return <button style={styles.disabledButton} disabled>Out of Stock</button>;
              if (hasVariants) return <button style={styles.variantButton} onClick={(e) => { e.stopPropagation(); onOpenModal(productData); }}>Select Option</button>;

              const itemInCart = cart.find(item => item.cartItemId === productData.id || item.id === productData.id);
              const currentStep = currentPricing.step; 
              const minQty = Math.max(currentPricing.moq || 1, currentStep); 

              if (itemInCart) {
                return (
                  <div style={styles.amazonPill}>
                    <button onClick={(e) => { e.stopPropagation(); const newQty = itemInCart.quantity - currentStep; const idToUse = itemInCart.cartItemId || itemInCart.id; if (newQty < minQty) removeFromCart(idToUse); else updateQuantity(idToUse, newQty); }} style={styles.pillBtn}>
                      {itemInCart.quantity - currentStep < minQty ? '🗑️' : '−'}
                    </button>
                    <span style={styles.pillQty}>{itemInCart.quantity}</span>
                    <button onClick={(e) => { e.stopPropagation(); const idToUse = itemInCart.cartItemId || itemInCart.id; updateQuantity(idToUse, itemInCart.quantity + currentStep); }} style={styles.pillBtn}>+</button>
                  </div>
                );
              } else {
                return <button style={styles.button} onClick={(e) => { e.stopPropagation(); addToCart(productData, minQty); }}>Add to Cart</button>;
              }
            })()}
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  card: { backgroundColor: '#FFF', borderRadius: '8px', border: '1px solid #EAEAEA', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s' },
  imageContainer: { backgroundColor: '#FAFAFA', position: 'relative', cursor: 'pointer', borderBottom: '1px solid #EAEAEA', overflow: 'hidden', transition: 'height 0.2s ease-out' },
  scroller: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '100%', scrollbarWidth: 'none' },
  imageWrapper: { flex: '0 0 100%', width: '100%', height: '100%', position: 'relative', scrollSnapAlign: 'start', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  auraBackground: { position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(10px)', opacity: 0.3, zIndex: 0 },
  image: { width: '80%', height: '80%', objectFit: 'contain', zIndex: 1, position: 'relative', borderRadius: '4px' },
  badge: { position: 'absolute', top: '8px', right: '8px', backgroundColor: '#111', color: '#FFF', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', zIndex: 2, letterSpacing: '0.5px' },
  outOfStockBadge: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(200,0,0,0.85)', color: '#FFF', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '700', zIndex: 5, letterSpacing: '1px', whiteSpace: 'nowrap' },
  outOfStockBadgeCompact: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(200,0,0,0.85)', color: '#FFF', padding: '4px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: '700', zIndex: 5, letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  info: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  title: { margin: 0, color: '#111', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  price: { margin: 0, fontWeight: '700', color: '#111' },
  unit: { fontSize: '0.75rem', color: '#666', fontWeight: '500' },
  internalPricingBox: { display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#F9F8F6', padding: '6px 8px', borderRadius: '4px', border: '1px solid #EAEAEA' },
  internalPriceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  internalLabel: { color: '#666', fontWeight: '600', textTransform: 'uppercase' },
  internalValue: { color: '#111', fontWeight: '700' },
  moqBox: { display: 'flex', backgroundColor: '#FAFAFA', borderRadius: '4px', padding: '6px 8px', border: '1px solid #F3F4F6' },
  moqItem: { flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#666' },
  divider: { width: '1px', backgroundColor: '#EAEAEA', margin: '0 8px' },
  cartonBadge: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFAF0', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.3)', fontSize: '0.75rem', color: '#B8860B' },
  button: { width: '100%', backgroundColor: '#111', color: '#FFF', border: 'none', padding: '0', borderRadius: '4px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px', height: '36px', transition: 'background 0.2s' },
  disabledButton: { width: '100%', backgroundColor: '#EAEAEA', color: '#999', border: 'none', padding: '0', borderRadius: '4px', fontWeight: '600', fontSize: '0.9rem', cursor: 'not-allowed', marginTop: '4px', height: '36px' },
  variantButton: { width: '100%', backgroundColor: '#F9F8F6', color: '#111', border: '1px solid #D1D5DB', padding: '0', borderRadius: '4px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px', height: '36px', transition: 'all 0.2s' },
  amazonPill: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '0', backgroundColor: '#FFF', marginTop: '4px', height: '36px', boxSizing: 'border-box' },
  pillBtn: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#111', width: '32px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pillQty: { fontWeight: '600', fontSize: '0.95rem', color: '#111', minWidth: '24px', textAlign: 'center' },
};

export default ProductCard;