import { createContext, useState, useContext } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const { userTier } = useAuth();

  // Helper function to figure out the correct price and MOQ based on the current user's tier
  const getTierDetails = (product) => {
    if (userTier === 'bulk' && product.bulkPrice) return { price: product.bulkPrice, moq: product.moq || 1, label: 'Bulk Rate' };
    if (userTier === 'wholesale' && product.wholesalePrice) return { price: product.wholesalePrice, moq: product.moq || 1, label: 'Wholesale Rate' };
    return { price: product.price, moq: 1, label: null }; // Default Retail
  };

 // Update this function inside CartContext.jsx
  const addToCart = (product, specificQty = null) => {
    const tierDetails = getTierDetails(product);
    
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      
      // If user specified a quantity in the modal, use it. Otherwise default to packSize (if adding more) or MOQ (if new)
      if (existing) {
        const qtyToAdd = specificQty !== null ? specificQty : (product.packSize || 1);
        return prevCart.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + qtyToAdd } 
          : item
        );
      }
      
      const initialQty = specificQty !== null ? specificQty : tierDetails.moq;
      return [...prevCart, { ...product, quantity: initialQty, currentPrice: tierDetails.price }];
    });
  };

  const updateQuantity = (id, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
    }
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, cartTotal, getTierDetails }}>
      {children}
    </CartContext.Provider>
  );
};