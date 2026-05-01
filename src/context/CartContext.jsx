import { createContext, useState, useContext } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const { userTier } = useAuth(); 

  // 🧠 SPRINT 4.5: Variant-Aware Tier Engine
  // Now accepts an optional 'variant' parameter to check for price overrides
  const getTierDetails = (product, variant = null) => {
    // Determine the base prices
    let finalRetail = product.retail || product.price || 0;
    let finalWs = product.ws || product.wholesalePrice || finalRetail;
    let finalBulk = product.bulk || product.bulkPrice || finalRetail;

    // If a variant is passed, check if it has custom prices. If so, override.
    if (variant) {
      if (variant.retail != null) finalRetail = variant.retail;
      if (variant.ws != null) finalWs = variant.ws;
      if (variant.bulk != null) finalBulk = variant.bulk;
    }

    if (userTier === 'bulk') {
      return { 
        price: finalBulk, 
        moq: product.bulkMoq || product.moq || 1, 
        label: 'Bulk Rate' 
      };
    }
    if (userTier === 'wholesale' || userTier === 'admin') {
      return { 
        price: finalWs, 
        moq: product.wsMoq || product.moq || 1, 
        label: 'Wholesale Rate' 
      };
    }
    
    // Default Retail
    return { 
      price: finalRetail, 
      moq: product.retailMoq || product.moq || 1, 
      label: null 
    }; 
  };

  // 🧠 SPRINT 4.5: Composite Key Cart Logic
  const addToCart = (product, specificQty = null, selectedVariant = null) => {
    const tierDetails = getTierDetails(product, selectedVariant);
    const packSize = product.packSize || 1;
    const minRequiredQty = Math.max(tierDetails.moq, packSize);
    
    // ✨ THE COMPOSITE KEY: "productId-variantName" (e.g. "123-Gold")
    // If no variant selected, just use the product ID.
    const cartItemId = selectedVariant ? `${product.id}-${selectedVariant.name}` : product.id;
    
    setCart(prevCart => {
      const existing = prevCart.find(item => item.cartItemId === cartItemId);
      
      if (existing) {
        const qtyToAdd = specificQty !== null ? specificQty : packSize;
        return prevCart.map(item => item.cartItemId === cartItemId 
          ? { ...item, quantity: item.quantity + qtyToAdd } 
          : item
        );
      }
      
      const initialQty = specificQty !== null ? specificQty : minRequiredQty;
      
      // Save all data into the cart object
      return [...prevCart, { 
        ...product, 
        cartItemId: cartItemId, // Unique ID for this specific row
        variantName: selectedVariant ? selectedVariant.name : null,
        variantObj: selectedVariant || null, // Keep the full object for future price recalcs
        quantity: initialQty 
      }];
    });
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    } else {
      setCart(prev => prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item));
    }
  };

  const removeFromCart = (cartItemId) => setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // 🧠 Recalculates total based on current tier AND specific variant price
  const cartTotal = cart.reduce((sum, item) => sum + (getTierDetails(item, item.variantObj).price * item.quantity), 0);

  const generateWhatsAppOrder = (adminPhone = "918851990042") => {
    if (cart.length === 0) return;

    let text = `*NEW ORDER FROM GARV GIFT GALLERY* 🛍️\n\n`;
    text += `*Customer Tier:* ${userTier ? userTier.toUpperCase() : 'RETAIL'}\n`;
    text += `---------------------------\n`;

    cart.forEach((item, index) => {
      const tier = getTierDetails(item, item.variantObj);
      const subtotal = tier.price * item.quantity;
      
      // Include variant name in the title if it exists
      const itemTitle = item.variantName ? `${item.title || item.name} (${item.variantName})` : (item.title || item.name);
      
      text += `*${index + 1}. ${itemTitle}*\n`;
      text += `Qty: ${item.quantity} (Pack Size: ${item.packSize || 1})\n`;
      text += `Price: ₹${tier.price} /pc\n`;
      text += `Subtotal: ₹${subtotal}\n\n`;
    });

    text += `---------------------------\n`;
    text += `*TOTAL AMOUNT: ₹${cartTotal}*\n`;
    text += `---------------------------\n`;
    text += `Please confirm availability and dispatch details.`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${adminPhone}?text=${encodedText}`, '_blank');
  };

  return (
    <CartContext.Provider value={{ 
      cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, cartTotal, getTierDetails, generateWhatsAppOrder 
    }}>
      {children}
    </CartContext.Provider>
  );
};
