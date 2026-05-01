import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const ProductCard = ({ productData, onOpenModal }) => {
  const { addToCart, getTierDetails, cart, updateQuantity, removeFromCart } = useCart();
  const { isPremiumTier } = useAuth();
  
  const currentPricing = getTierDetails(productData);
  const imageArray = productData.images || (productData.image ? [productData.image] : []);

  // ✨ THE FIX: Check if this specific product has variants
  const hasVariants = productData.variants && productData.variants.length > 0;

  return (
    <div style={styles.card}>
      <div style={styles.imageContainer} onClick={() => onOpenModal(productData)}>
        
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
        
        {isPremiumTier && currentPricing.label && (
          <div style={styles.badge}>{currentPricing.label}</div>
        )}
      </div>

      <div style={styles.info}>
        <h3 style={styles.title} onClick={() => onOpenModal(productData)}>{productData.title || "Unnamed Product"}</h3>
        
        <p style={styles.price}>₹{currentPricing.price} <span style={styles.unit}>/ pc</span></p>
        
        <div style={styles.moqBox}>
          <div style={styles.moqItem}><span>MOQ</span><b>{currentPricing.moq || 1}</b></div>
          <div style={styles.divider}></div>
          <div style={styles.moqItem}><span>Pack</span><b>{productData.packSize || 1}</b></div>
        </div>

        {(() => {
          // ✨ THE FIX: If it has variants, force the user to open the modal.
          if (hasVariants) {
            return (
              <button 
                style={styles.variantButton} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onOpenModal(productData); // Opens the modal instead of adding to cart
                }}
              >
                Select Option
              </button>
            );
          }

          // Normal logic for standard products without variants
          // Note: We check against cartItemId to sync with the Sprint 4.5 engine upgrade
          const itemInCart = cart.find(item => item.cartItemId === productData.id || item.id === productData.id);
          const moq = currentPricing.moq || 1;
          const packSize = productData.packSize || 1;
          const minQty = Math.max(moq, packSize); 

          if (itemInCart) {
            return (
              <div style={styles.amazonPill}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const newQty = itemInCart.quantity - packSize;
                    const idToUse = itemInCart.cartItemId || itemInCart.id;
                    if (newQty < minQty) removeFromCart(idToUse);
                    else updateQuantity(idToUse, newQty);
                  }}
                  style={styles.pillBtn}
                >
                  {itemInCart.quantity - packSize < minQty ? '🗑️' : '−'}
                </button>
                <span style={styles.pillQty}>{itemInCart.quantity}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idToUse = itemInCart.cartItemId || itemInCart.id;
                    updateQuantity(idToUse, itemInCart.quantity + packSize);
                  }}
                  style={styles.pillBtn}
                >
                  +
                </button>
              </div>
            );
          } else {
            return (
              <button 
                style={styles.button} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  addToCart(productData, minQty); 
                }}
              >
                Add to Cart
              </button>
            );
          }
        })()}

      </div>
    </div>
  );
};

const styles = {
  card: { backgroundColor: '#FFF', borderRadius: '8px', border: '1px solid #EAEAEA', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' },
  imageContainer: { height: '180px', backgroundColor: '#FAFAFA', position: 'relative', cursor: 'pointer', borderBottom: '1px solid #EAEAEA', overflow: 'hidden' },
  scroller: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '100%', scrollbarWidth: 'none' },
  imageWrapper: { flex: '0 0 100%', width: '100%', height: '100%', position: 'relative', scrollSnapAlign: 'start', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  auraBackground: { position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(10px)', opacity: 0.3, zIndex: 0 },
  image: { width: '80%', height: '80%', objectFit: 'contain', zIndex: 1, position: 'relative', borderRadius: '4px' },
  badge: { position: 'absolute', top: '8px', right: '8px', backgroundColor: '#111', color: '#FFF', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', zIndex: 2, letterSpacing: '0.5px' },
  
  info: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  title: { margin: 0, fontSize: '0.95rem', color: '#111', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  price: { margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#111' },
  unit: { fontSize: '0.75rem', color: '#666', fontWeight: '400' },
  
  moqBox: { display: 'flex', backgroundColor: '#FAFAFA', borderRadius: '4px', padding: '6px 8px', marginTop: 'auto', border: '1px solid #F3F4F6' },
  moqItem: { flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#666' },
  divider: { width: '1px', backgroundColor: '#EAEAEA', margin: '0 8px' },
  
  button: { width: '100%', backgroundColor: '#111', color: '#FFF', border: 'none', padding: '0', borderRadius: '4px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px', height: '36px', transition: 'background 0.2s' },
  
  // ✨ THE FIX: Styling for the interceptor button
  variantButton: { width: '100%', backgroundColor: '#F9F8F6', color: '#111', border: '1px solid #D1D5DB', padding: '0', borderRadius: '4px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px', height: '36px', transition: 'all 0.2s' },

  amazonPill: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '0', backgroundColor: '#FFF', marginTop: '4px', height: '36px', boxSizing: 'border-box' },
  pillBtn: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#111', width: '32px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pillQty: { fontWeight: '600', fontSize: '0.95rem', color: '#111', minWidth: '24px', textAlign: 'center' },
};

export default ProductCard;
