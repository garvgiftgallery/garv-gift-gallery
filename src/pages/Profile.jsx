import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'; 
import { db } from '../firebase'; 

const Profile = () => {
  const { currentUser, userTier, logout } = useAuth();
  const navigate = useNavigate();

  // --- STATES ---
  const [customerData, setCustomerData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Editing States
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser?.displayName || '');
  
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Referral States
  const [referralCode, setReferralCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');
  const [isApplyingCode, setIsApplyingCode] = useState(false);

  // --- FETCH USER DATA & ORDERS ---
  useEffect(() => {
    if (!currentUser) return;

    const fetchProfileAndOrders = async () => {
      try {
        const docRef = doc(db, 'customers', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCustomerData(docSnap.data());
        }

        const q = query(
          collection(db, 'orders'), 
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const orderSnap = await getDocs(q);
        setOrders(orderSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (err) {
        console.error("Error fetching profile/orders:", err);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchProfileAndOrders();
  }, [currentUser]);

  // --- FUNCTIONS ---
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleSaveName = async () => {
    setError('');
    const sanitizedName = newName.trim();
    if (!sanitizedName) return setError('Name cannot be empty.');
    if (sanitizedName.length > 50) return setError('Name is too long (max 50 characters).');

    setIsSaving(true);
    try {
      await updateProfile(currentUser, { displayName: sanitizedName });
      const userRef = doc(db, 'customers', currentUser.uid);
      await setDoc(userRef, { name: sanitizedName }, { merge: true });
      
      setCustomerData(prev => ({ ...prev, name: sanitizedName }));
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      setError('Failed to update name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ✨ NEW: Smart Phone Extractor for Edit Mode
  const openPhoneEdit = () => {
    const existingPhone = customerData?.phone || currentUser?.phoneNumber || '';
    const digitsOnly = existingPhone.replace(/\D/g, ''); // Strip all non-numbers
    
    // If we have at least 10 digits, assume the last 10 are the local number
    if (digitsOnly.length >= 10) {
      setNewPhone(digitsOnly.slice(-10));
      const extractedCode = existingPhone.replace(digitsOnly.slice(-10), '').trim();
      setCountryCode(extractedCode.startsWith('+') ? extractedCode : `+${extractedCode || '91'}`);
    } else {
      setNewPhone(digitsOnly);
      setCountryCode('+91');
    }
    
    setError('');
    setIsEditingPhone(true);
  };

  // ✨ NEW: Strict Phone Validation
  const handleSavePhone = async () => {
    setError('');
    const sanitizedPhone = newPhone.replace(/\D/g, ''); // Final safety strip

    if (sanitizedPhone.length !== 10) {
      return setError('Mobile number must be exactly 10 digits.');
    }

    const fullPhone = `${countryCode}${sanitizedPhone}`;
    setIsSaving(true);

    try {
      const userRef = doc(db, 'customers', currentUser.uid);
      await setDoc(userRef, { phone: fullPhone }, { merge: true });
      
      setCustomerData(prev => ({ ...prev, phone: fullPhone }));
      setIsEditingPhone(false);
    } catch (err) {
      console.error(err);
      setError('Failed to update phone number. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyCode = async () => {
    setCodeError('');
    setCodeSuccess('');
    if (!referralCode.trim()) return;

    setIsApplyingCode(true);
    try {
      const formattedCode = referralCode.trim().toUpperCase();
      const codeRef = doc(db, 'referralCodes', formattedCode);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        setCodeError('Invalid or expired referral code.');
        setIsApplyingCode(false);
        return;
      }

      const targetTier = codeSnap.data().tier; 
      const userRef = doc(db, 'customers', currentUser.uid);
      await setDoc(userRef, { tier: targetTier, appliedCode: formattedCode }, { merge: true });

      setCodeSuccess(`Success! You have been upgraded to the ${targetTier.toUpperCase()} tier.`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error(err);
      setCodeError('Error applying code. Please try again.');
    } finally {
      setIsApplyingCode(false);
    }
  };

  const initial = customerData?.name 
    ? customerData.name.charAt(0).toUpperCase() 
    : (currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : (currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'V'));

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-12">
      {/* 💳 PROFILE CARD */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 relative">
        
        <button onClick={handleLogout} className="absolute top-6 right-6 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
          Sign Out
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-4">
          <div className="w-20 h-20 bg-black text-[#D4AF37] rounded-full flex items-center justify-center text-3xl font-bold">
            {initial}
          </div>
          
          <div className="w-full max-w-sm flex flex-col items-center">
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            
            {/* NAME EDITING */}
            {isEditingName ? (
              <div className="flex flex-col w-full space-y-2 mt-2">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-center" placeholder="Enter your name" />
                <div className="flex justify-center gap-2">
                  <button onClick={handleSaveName} disabled={isSaving} className="bg-[#111111] text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-black disabled:opacity-50 transition-colors">Save</button>
                  <button onClick={() => { setIsEditingName(false); setNewName(customerData?.name || currentUser?.displayName || ''); setError(''); }} disabled={isSaving} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <h1 className="text-2xl font-bold text-gray-900">{customerData?.name || currentUser?.displayName || 'Valued Customer'}</h1>
                <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-[#D4AF37] transition-colors mt-1" title="Edit Name">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>
            )}

            {/* EMAIL DISPLAY */}
            {currentUser?.email && <p className="text-gray-500 text-sm mt-1">{currentUser.email}</p>}

            {/* ✨ STRICT PHONE EDITING UI */}
            {isEditingPhone ? (
              <div className="flex flex-col w-full space-y-3 mt-4">
                <div className="flex gap-2">
                  <select 
                    value={countryCode} 
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none bg-white text-center font-medium"
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US/CA)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+61">+61 (AU)</option>
                    <option value="+971">+971 (UAE)</option>
                  </select>
                  <input 
                    type="text" 
                    value={newPhone} 
                    // ONLY allows numbers. Destroys any letters or symbols instantly.
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))} 
                    maxLength={10}
                    className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-center tracking-widest font-medium" 
                    placeholder="10-Digit Number" 
                  />
                </div>
                <div className="flex justify-center gap-2">
                  <button onClick={handleSavePhone} disabled={isSaving} className="bg-[#111111] text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-black disabled:opacity-50 transition-colors">Save Phone</button>
                  <button onClick={() => { setIsEditingPhone(false); setError(''); }} disabled={isSaving} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-600 text-sm font-medium">{customerData?.phone || currentUser?.phoneNumber || 'No phone provided'}</p>
                <button onClick={openPhoneEdit} className="text-gray-400 hover:text-[#D4AF37] transition-colors" title="Edit Phone">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>
            )}
            
            {/* TIER & STATUS BADGES */}
            <div className="flex gap-2 mt-4">
              <div className="bg-[#F9F8F6] border border-[#D4AF37] text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Tier: {userTier}
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${customerData?.status === 'pending' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                Status: {customerData?.status || 'Active'}
              </div>
            </div>
          </div>
        </div>

        {userTier === 'admin' && (
          <div className="mt-8 border-t border-gray-100 pt-6 flex justify-center">
            <Link to="/garv-secure-admin" className="bg-[#D4AF37] text-white px-8 py-3 rounded-md font-bold uppercase tracking-wider hover:bg-[#b5952f] transition-colors shadow-md flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Open Admin Dashboard
            </Link>
          </div>
        )}
      </div>

      {/* 🎟️ B2B REFERRAL CODE SECTION */}
      {userTier === 'retail' && (
        <div className="mt-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Upgrade to B2B Pricing</h3>
          <p className="text-sm text-gray-500 mb-5">Have a wholesale or bulk access code? Enter it below to unlock premium pricing.</p>
          
          {codeError && <p className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{codeError}</p>}
          {codeSuccess && <p className="text-green-700 text-sm mb-3 bg-green-50 p-2 rounded font-medium">{codeSuccess}</p>}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none uppercase tracking-widest font-bold text-gray-700" />
            <button onClick={handleApplyCode} disabled={isApplyingCode} className="bg-[#111111] text-white px-8 py-3 rounded-md font-bold hover:bg-black disabled:opacity-50 transition-colors whitespace-nowrap">
              {isApplyingCode ? 'Verifying...' : 'Apply Code'}
            </button>
          </div>
        </div>
      )}

      {/* 📦 LIVE ORDER HISTORY */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 px-1 uppercase tracking-tight">Order History</h2>
        
        {loadingOrders ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">Loading your orders...</div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
            You haven't placed any orders yet. <Link to="/" className="text-[#D4AF37] font-bold hover:underline ml-1">Start shopping</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#D4AF37] transition">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-gray-900">Order #{order.id.slice(0, 6).toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                      {order.status === 'pending_whatsapp' ? 'Pending' : order.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently Placed'}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    {order.items?.length || 0} items ordered
                  </p>
                </div>
                
                <div className="flex flex-col md:items-end border-t border-gray-100 pt-4 md:border-t-0 md:pt-0">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Total Amount</span>
                  <span className="text-xl font-bold text-gray-900">₹{order.totalAmount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Profile;
