import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile, 
  signOut        
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'; // <-- Added updateDoc

const AuthPage = () => {
  // Navigation & States
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('email'); 
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Loading state to prevent double-clicks
  const [isLoading, setIsLoading] = useState(false);
  
  // Email/Password States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Extra Sign-Up Details
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  
  // Phone OTP States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Initialize invisible reCAPTCHA
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved
        }
      });
    }
  }, []);

  // ------------------------------------
  // DATABASE HELPER 
  // ------------------------------------
  const ensureUserInDB = async (user, additionalData = {}) => {
    const docRef = doc(db, 'customers', user.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        name: user.displayName || additionalData.name || 'Valued Customer',
        email: user.email || additionalData.email || 'Phone User',
        phone: user.phoneNumber || additionalData.phone || '',
        tier: 'retail',         
        status: 'pending',      // 🚨 Drops user straight into the Admin Approval Inbox
        createdAt: new Date()
      });
    }
  };

  // ------------------------------------
  // HYBRID EMAIL / PASSWORD HANDLER 
  // ------------------------------------
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true); 

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 1. Fetch user data to check if Admin manually approved them
        const userDocRef = doc(db, 'customers', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.exists() ? userDocSnap.data() : null;
        
        const isApprovedByAdmin = userData?.status === 'active' || userData?.tier !== 'retail';
        const masterAdminEmail = "your_admin_email@gmail.com"; // 🚨 REPLACE WITH YOUR ACTUAL ADMIN EMAIL

        // 2. THE HYBRID CHECK: Block if NOT email verified AND NOT admin approved
        if (!user.emailVerified && !isApprovedByAdmin && user.email !== masterAdminEmail) {
          await sendEmailVerification(user); // Send fresh link just in case
          await signOut(auth); 
          setError('Account Pending: Please verify your email using the link sent to your inbox, or await Admin approval.');
          setIsLoading(false);
          return;
        }

        // 3. Auto-Activate: If they verified via email but DB still says pending, update DB!
        if (user.emailVerified && userData?.status === 'pending') {
          await updateDoc(userDocRef, { status: 'active' });
        }
        
        navigate('/profile');
      } else {
        // 📝 Sign-Up Logic
        if (!fullName.trim()) throw new Error('Full Name is required.');

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // 1. Immediately attach name to Firebase Auth Token
        await updateProfile(userCredential.user, { displayName: fullName.trim() });

        // 2. Save to database (Triggering 'pending' status for Admin Inbox)
        await ensureUserInDB(userCredential.user, { 
          name: fullName.trim(), 
          phone: contactNumber.trim(), 
          email: email.trim()
        });
        
        // 3. Send email verification
        await sendEmailVerification(userCredential.user);

        // 4. Force sign out so they can't access wholesale/orders until verified/approved
        await signOut(auth);

        // 5. Keep them on the page, clear form, show success, and slide to Login
        setMessage('Account created! Please verify your email or await Admin approval to log in.');
        setIsLogin(true); 
        setFullName('');
        setContactNumber('');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered. Please log in.');
      else if (err.code === 'auth/invalid-credential') setError('Incorrect email or password.');
      else setError(err.message.replace('Firebase: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------
  // GOOGLE AUTH HANDLER
  // ------------------------------------
  const handleGoogleAuth = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureUserInDB(result.user); 
      
      // Auto-activate Google users since Google already verified their email
      const userDocRef = doc(db, 'customers', result.user.uid);
      await updateDoc(userDocRef, { status: 'active' });
      
      navigate('/profile');
    } catch (err) {
      setError('Google Sign-In failed or was cancelled.');
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------
  // PHONE AUTH HANDLERS
  // ------------------------------------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      window.confirmationResult = confirmationResult;
      setOtpSent(true);
      setMessage('OTP sent securely via SMS.');
    } catch (err) {
      setError('Failed to send OTP. Ensure phone format is correct and billing is enabled in Firebase.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await window.confirmationResult.confirm(otp);
      await ensureUserInDB(result.user); 
      
      // Auto-activate Phone users since OTP verifies them
      const userDocRef = doc(db, 'customers', result.user.uid);
      await updateDoc(userDocRef, { status: 'active' });

      navigate('/profile');
    } catch (err) {
      setError('Invalid OTP code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------
  // RENDER UI
  // ------------------------------------
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        {/* WELCOMING TITLE */}
        <h2 className="text-2xl font-bold text-center mb-6 tracking-wide text-black uppercase">
          Welcome to <span className="text-[#D4AF37]">GARV</span>
        </h2>

        {/* ALERTS */}
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 text-center border border-red-200">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-4 text-center border border-green-200">{message}</div>}

        {/* TAB NAVIGATION */}
        <div className="flex mb-6 border-b border-gray-200">
          <button 
            disabled={isLoading}
            className={`flex-1 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${authMethod === 'email' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-400 hover:text-black'}`}
            onClick={() => { setAuthMethod('email'); setError(''); setMessage(''); setIsLogin(true); }}
          >
            Email
          </button>
          <button 
            disabled={isLoading}
            className={`flex-1 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${authMethod === 'phone' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-400 hover:text-black'}`}
            onClick={() => { setAuthMethod('phone'); setError(''); setMessage(''); }}
          >
            Phone (OTP)
          </button>
        </div>

        {/* EMAIL & PASSWORD FORM */}
        {authMethod === 'email' && (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                      disabled={isLoading}
                      type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-50"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Number <span className="text-gray-400 font-normal text-xs">(Optional)</span>
                    </label>
                    <input 
                      disabled={isLoading}
                      type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-50"
                      placeholder="+91 9811X XXXXX"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                  disabled={isLoading}
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-50"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  disabled={isLoading}
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-50"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#111111] text-white p-3 rounded-md font-semibold hover:bg-black transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </>
                ) : (
                  isLogin ? 'Sign In Securely' : 'Create Account'
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                disabled={isLoading}
                onClick={() => setIsLogin(!isLogin)} 
                className="text-[#D4AF37] font-semibold hover:underline disabled:opacity-50"
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>

            <div className="mt-6 flex items-center justify-between">
              <hr className="w-full border-gray-300" /><span className="px-3 text-gray-400 text-sm">OR</span><hr className="w-full border-gray-300" />
            </div>

            <button 
              onClick={handleGoogleAuth} 
              disabled={isLoading}
              className="w-full mt-6 flex items-center justify-center gap-3 border border-gray-300 p-3 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {/* PHONE OTP FORM */}
        {authMethod === 'phone' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4 text-center">Secured by Google reCAPTCHA</p>
            
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input 
                    disabled={isLoading}
                    type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-50"
                    placeholder="9811X XXXXX"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-[#111111] text-white p-3 rounded-md font-semibold hover:bg-black transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isLoading ? 'Sending...' : 'Send OTP via SMS'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-Digit OTP</label>
                  <input 
                    disabled={isLoading}
                    type="text" required maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none tracking-widest text-center text-lg disabled:bg-gray-50"
                    placeholder="------"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-[#D4AF37] text-white p-3 rounded-md font-semibold hover:bg-[#b5952f] transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <button 
                  type="button" 
                  disabled={isLoading}
                  onClick={() => setOtpSent(false)} 
                  className="w-full text-sm text-gray-500 hover:text-black mt-2 disabled:opacity-50"
                >
                  Change Phone Number
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AuthPage;