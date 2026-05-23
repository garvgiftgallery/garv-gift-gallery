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

  const [presentationMode, setPresentationMode] = useState('all');

  const ADMIN_EMAIL = "garvgiftgallery@gmail.com"; 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === ADMIN_EMAIL) {
          setCurrentUser(user);
          setUserTier('admin');
        } else {
          const docRef = doc(db, 'customers', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 🔒 SECURITY GATE: If user is somehow logged in but marked pending, kick them out
            if (data.status === 'pending') {
              await signOut(auth);
              setCurrentUser(null);
              setUserTier('guest');
            } else {
              setCurrentUser(user);
              setUserTier(data.tier || 'retail');
            }
          } else {
            // Document doesn't exist yet (rare during signup flow), just set as guest until verified
            setCurrentUser(user);
            setUserTier('guest');
          }
        }
      } else {
        setCurrentUser(null);
        setUserTier('guest');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  
  const logout = async () => {
    await signOut(auth);
    setPresentationMode('all'); 
  };
  
  const isPremiumTier = userTier === 'wholesale' || userTier === 'bulk';

  return (
    <AuthContext.Provider value={{ 
      currentUser, userTier, isPremiumTier, 
      login, logout, searchQuery, setSearchQuery,
      presentationMode, setPresentationMode
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};