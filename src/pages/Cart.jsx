import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, cartTotal, clearCart, getTierDetails } = useCart();
  const { userTier, currentUser } = useAuth(); 
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnifiedCheckout = async () => {
    if (cart.length === 0 || !currentUser) return;
    setIsSubmitting(true);

    try {
      let customerName = "Valued Customer";
      let customerEmail = currentUser.email || "";

      const userDocRef = doc(db, 'customers', currentUser.phoneNumber);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        customerName = userDocSnap.data().name || customerName;
        customerEmail = userDocSnap.data().email || customerEmail;
      }

      const orderRef = await addDoc(collection(db, 'orders'), {
        customerName: customerName,
        customerPhone: currentUser.phoneNumber,
        customerEmail: customerEmail,
        items: cart.map(item => ({ productId: item.id, title: item.title, quantity: item.quantity, pricePaid: item.currentPrice })),
        totalAmount: cartTotal, 
        tierPlacedAt: userTier, 
        status: 'pending_whatsapp',
        createdAt: serverTimestamp()
      });

      let text = `*New Order from GARV GIFT GALLERY* 🛍️\n`;
      text += `*Name:* ${customerName}\n`;
      text += `*Phone:* ${currentUser.phoneNumber}\n`;
      text += `*Tier:* ${userTier.toUpperCase()}\n\n`;
      text += `*Order Details (ID: ${orderRef.id.slice(0, 6).toUpperCase()}):*\n`;
      cart.forEach((item, index) => {
        text += `${index + 1}. ${item.title}\n   ${item.quantity} pcs x ₹${item.currentPrice} = ₹${item.quantity * item.currentPrice}\n`;
      });
      text += `\n*Estimated Total: ₹${cartTotal}*\n`;
      text += `\nPlease confirm my order!`;

      const encodedText = encodeURIComponent(text);
      // ⚠️ CHANGE THIS TO YOUR ACTUAL WHATSAPP NUMBER
      const myWhatsAppNumber = "918851990042"; 
      const whatsappUrl = `https://wa.me/${myWhatsAppNumber}?text=${encodedText}`;

      clearCart();
      window.open(whatsappUrl, '_blank'); 
      navigate('/profile'); 

    } catch (error) {
      console.error("Checkout Error:", error);
      alert('❌ Failed to process order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div style={styles.emptyState}>
        <h2 style={{ color: '#111', fontSize: '1.2rem', marginBottom: '8px' }}>Your cart is empty</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '24px' }}>Browse our catalogue to add premium items.</p>
        <Link to="/" style={styles.checkoutBtn}>Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Shopping Cart</h2>
      
      <div style={styles.layout}>
        {/* Left Side: Compact Items List */}
       <div style={styles.itemList}>
          {cart.map(item => {
            // ✨ Pull the correct tier MOQ and calculate minimum floor
            const moq = getTierDetails ? (getTierDetails(item).moq || 1) : (item.moq || 1);
            const packSize = item.packSize || 1;
            const minQty = Math.max(moq, packSize);

            return (
              <div key={item.id} style={styles.cartItem}>
                <img src={item.images?.[0] || item.image || "https://via.placeholder.com/150"} alt={item.title} style={styles.itemImage} />
                
                <div style={styles.itemDetails}>
                  <h3 style={styles.itemTitle}>{item.title}</h3>
                  <p style={styles.itemPrice}>₹{item.currentPrice} <span style={styles.unit}>/ pc</span></p>
                </div>

                <div style={styles.actionGroup}>
                  <div style={styles.amazonPill}>
                    <button 
                      onClick={() => {
                        const newQty = item.quantity - packSize;
                        if (newQty < minQty) removeFromCart(item.id);
                        else updateQuantity(item.id, newQty);
                      }}
                      style={styles.pillBtn}
                    >
                      {item.quantity - packSize < minQty ? '🗑️' : '−'}
                    </button>
                    <span style={styles.pillQty}>{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + packSize)}
                      style={styles.pillBtn}
                    >
                      +
                    </button>
                  </div>
                  
                  <button onClick={() => removeFromCart(item.id)} style={styles.trashBtn} title="Remove item">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Ultra-Modern Order Summary */}
        <div style={styles.summaryBox}>
          <h3 style={styles.summaryTitle}>Order Summary</h3>
          
          {/* ✨ NEW: Centered, Luxurious Tier Badge */}
          <div style={styles.tierContainer}>
            <span style={styles.tierBadge}>
              {userTier} Partner
            </span>
          </div>
          
          <div style={styles.summaryRow}>
            <span>Subtotal</span>
            <span style={{ fontWeight: '500', color: '#111' }}>₹{cartTotal}</span>
          </div>
          
          <div style={styles.totalRow}>
            <span>Estimated Total</span>
            <span>₹{cartTotal}</span>
          </div>

          <div style={{ marginTop: '20px' }}>
            {!currentUser ? (
              <Link to="/login" style={{...styles.checkoutBtn, display: 'block'}}>
                Login to Checkout
              </Link>
            ) : (
              <button style={styles.checkoutBtn} onClick={handleUnifiedCheckout} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </button>
            )}
          </div>
          
          <p style={styles.disclaimer}>
            You will be redirected to WhatsApp to confirm your order details.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '20px' },
  pageTitle: { color: '#111', margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: '600', letterSpacing: '-0.5px' },
  layout: { display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' },
  
  itemList: { flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: '12px' },
  cartItem: { display: 'flex', alignItems: 'center', backgroundColor: '#FFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #EAEAEA', gap: '16px' },
  itemImage: { width: '64px', height: '64px', objectFit: 'contain', backgroundColor: '#F9F8F6', borderRadius: '6px', padding: '4px' },
  
  itemDetails: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' },
  itemTitle: { margin: 0, fontSize: '0.95rem', color: '#111', fontWeight: '500' },
  itemPrice: { margin: 0, fontSize: '1rem', fontWeight: '600', color: '#111' },
  unit: { fontSize: '0.75rem', color: '#666', fontWeight: '400' },
  
  actionGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  amazonPill: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '0', backgroundColor: '#FFF', height: '32px', width: '90px' },
  pillBtn: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#111', width: '30px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pillQty: { fontWeight: '500', fontSize: '0.9rem', color: '#111', flex: 1, textAlign: 'center' },
  trashBtn: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' },

  summaryBox: { flex: '1 1 300px', backgroundColor: '#FAFAFA', padding: '24px', borderRadius: '8px', border: '1px solid #EAEAEA', position: 'sticky', top: '90px' },
  summaryTitle: { margin: '0 0 16px 0', color: '#111', fontSize: '1.05rem', fontWeight: '600', textAlign: 'center' },
  
  /* ✨ NEW: Luxurious Tier Badge Styling */
  tierContainer: { display: 'flex', justifyContent: 'center', marginBottom: '24px' },
  tierBadge: { 
    padding: '6px 14px', 
    borderRadius: '50px', 
    border: '1px solid #C5A059', // Elegant Gold Border
    backgroundColor: '#FFFAF0', // Ultra-faint warm glow
    color: '#B8860B', // Rich Gold Text
    fontSize: '0.75rem', 
    fontWeight: '700', 
    letterSpacing: '1px', 
    textTransform: 'uppercase',
    boxShadow: '0 2px 8px rgba(197, 160, 89, 0.1)' // Soft gold shadow
  },

  summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#444' },
  totalRow: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #EAEAEA', paddingTop: '12px', marginTop: '12px', fontSize: '1.1rem', color: '#111', fontWeight: '600' },
  
  checkoutBtn: { width: '100%', backgroundColor: '#111', color: '#FFF', padding: '12px', border: 'none', borderRadius: '6px', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s', textDecoration: 'none', boxSizing: 'border-box' },
  disclaimer: { fontSize: '0.75rem', color: '#888', textAlign: 'center', marginTop: '16px', lineHeight: '1.4' },
  
  emptyState: { textAlign: 'center', padding: '15vh 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }
};

export default Cart;