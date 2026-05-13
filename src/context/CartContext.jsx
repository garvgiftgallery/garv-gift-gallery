import { createContext, useState, useContext } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const { userTier } = useAuth(); 

  const getTierDetails = (product, variant = null) => {
    let finalRetail = product.retail || product.price || 0;
    let finalWs = product.ws || product.wholesalePrice || finalRetail;
    let finalBulk = product.bulk || product.bulkPrice || finalRetail;

    if (variant) {
      if (variant.retail != null) finalRetail = variant.retail;
      if (variant.ws != null) finalWs = variant.ws;
      if (variant.bulk != null) finalBulk = variant.bulk;
    }

    const universalStep = product.packSize || 1;

    if (userTier === 'bulk') {
      return { price: finalBulk, moq: product.bulkMoq || product.moq || universalStep, step: universalStep, label: 'Bulk Rate' };
    }
    
    if (['wholesale', 'admin', 'staff', 'management'].includes(userTier)) {
      return { price: finalWs, moq: product.wsMoq || product.moq || universalStep, step: universalStep, label: 'Wholesale Rate' };
    }
    
    return { price: finalRetail, moq: product.retailMoq || product.moq || universalStep, step: universalStep, label: null }; 
  };

  const addToCart = (product, specificQty = null, selectedVariant = null) => {
    const tierDetails = getTierDetails(product, selectedVariant);
    const packSize = tierDetails.step; 
    const minRequiredQty = Math.max(tierDetails.moq, packSize);
    
    const cartItemId = selectedVariant ? `${product.id}-${selectedVariant.name}` : product.id;
    
    const baseName = product.title || product.name || "Unnamed Product";
    const displayName = selectedVariant ? `${baseName} (${selectedVariant.name})` : baseName;

    // ✨ SMART IMAGE SELECTOR: Prioritizes Variant Image -> Base Image -> Any available Variant Image
    const variantImg = selectedVariant?.image || null;
    const defaultImg = (product.images && product.images.length > 0) ? product.images[0] : (product.image || null);
    const fallbackVariantImg = (product.variants && product.variants.length > 0) ? product.variants.find(v => v.image)?.image : null;
    
    const finalImgToSave = variantImg || defaultImg || fallbackVariantImg;

    setCart(prevCart => {
      const existing = prevCart.find(item => item.cartItemId === cartItemId);
      
      if (existing) {
        const qtyToAdd = specificQty !== null ? specificQty : packSize;
        return prevCart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + qtyToAdd } : item);
      }
      
      const initialQty = specificQty !== null ? specificQty : minRequiredQty;
      
      return [...prevCart, { 
        ...product, 
        title: displayName, 
        name: displayName,  
        image: finalImgToSave,           
        images: finalImgToSave ? [finalImgToSave] : [], 
        cartItemId: cartItemId, 
        variantName: selectedVariant ? selectedVariant.name : null,
        variantObj: selectedVariant || null, 
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
  const cartTotal = cart.reduce((sum, item) => sum + (getTierDetails(item, item.variantObj).price * item.quantity), 0);

  const generateWhatsAppOrder = (adminPhone = "918851990042") => {
    if (cart.length === 0) return;

    let text = `*NEW ORDER FROM GARV GIFT GALLERY* 🛍️\n\n`;
    text += `*Customer Tier:* ${userTier ? userTier.toUpperCase() : 'RETAIL'}\n`;
    text += `---------------------------\n`;

    cart.forEach((item, index) => {
      const tier = getTierDetails(item, item.variantObj);
      const subtotal = tier.price * item.quantity;
      
      text += `*${index + 1}. ${item.title || item.name}*\n`;
      text += `Qty: ${item.quantity} (Pack Size: ${tier.step})\n`;
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
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, cartTotal, getTierDetails, generateWhatsAppOrder }}>
      {children}
    </CartContext.Provider>
  );
};