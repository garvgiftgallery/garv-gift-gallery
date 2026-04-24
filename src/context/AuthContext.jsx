import { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userTier, setUserTier] = useState('guest'); // 'guest', 'retail', 'wholesale', 'bulk', or 'admin'
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        if (user.phoneNumber) {
          // This is a Customer (Logged in via OTP)
          const docRef = doc(db, 'customers', user.phoneNumber);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().tier) {
            setUserTier(docSnap.data().tier); // Apply their secure database tier!
          } else {
            setUserTier('retail'); // Fallback
          }
        } else {
          // This is the Admin (Logged in via Email)
          setUserTier('admin');
        }
      } else {
        setUserTier('guest');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  
  const isPremiumTier = userTier === 'wholesale' || userTier === 'bulk';

  return (
    <AuthContext.Provider value={{ 
      currentUser, userTier, isPremiumTier, 
      login, logout, searchQuery, setSearchQuery 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};