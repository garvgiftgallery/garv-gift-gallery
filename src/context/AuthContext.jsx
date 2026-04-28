import { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userTier, setUserTier] = useState('guest'); 
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ⚠️ REPLACE THIS WITH YOUR ACTUAL ADMIN EMAIL
  const ADMIN_EMAIL = "garvgiftgallery@gmail.com"; 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // 1. Check if this is the Admin logging in
        if (user.email === ADMIN_EMAIL) {
          setUserTier('admin');
        } else {
          // 2. This is a Customer. Fetch their tier using their unique UID!
          const docRef = doc(db, 'customers', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().tier) {
            setUserTier(docSnap.data().tier); // Apply their secure database tier
          } else {
            setUserTier('retail'); // Fallback for brand new users
          }
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
