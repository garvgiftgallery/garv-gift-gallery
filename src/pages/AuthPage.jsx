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
  signInWithPhoneNumber
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AuthPage = () => {
  // Navigation & States
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('email'); // 'email' or 'phone'
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
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
  // Added additionalData parameter to catch the new Name and Phone from Sign Up
  const ensureUserInDB = async (user, additionalData = {}) => {
    const docRef = doc(db, 'customers', user.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        name: user.displayName || additionalData.name || 'Valued Customer',
        email: user.email || additionalData.email || 'Phone User',
        phone: user.phoneNumber || additionalData.phone || '',
        tier: 'retail', // Default tier
        createdAt: new Date()
      });
    }
  };

  // ------------------------------------
  // EMAIL / PASSWORD HANDLER
  // ------------------------------------
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setMessage('Please check your inbox to verify your email address. You can still browse the shop.');
        }
        navigate('/profile');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save the extra fields to the database!
        await ensureUserInDB(userCredential.user, { 
          name: fullName, 
          phone: contactNumber,
          email: email
        });
        
        await sendEmailVerification(userCredential.user);
        setMessage('Account created! A verification link has been sent to your email.');
        setIsLogin(true); // Switch to login view after successful signup
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
  };

  // ------------------------------------
  // GOOGLE AUTH HANDLER
  // ------------------------------------
  const handleGoogleAuth = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureUserInDB(result.user);
      navigate('/profile');
    } catch (err) {
      setError('Google Sign-In failed or was cancelled.');
    }
  };

  // ------------------------------------
  // PHONE AUTH HANDLERS
  // ------------------------------------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
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
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await window.confirmationResult.confirm(otp);
      await ensureUserInDB(result.user);
      navigate('/profile');
    } catch (err) {
      setError('Invalid OTP code. Please try again.');
    }
  };

  // ------------------------------------
  // RENDER UI
  // ------------------------------------
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        {/* NEW WELCOMING TITLE */}
        <h2 className="text-2xl font-bold text-center mb-6 tracking-wide text-black uppercase">
          Welcome to <span className="text-[#D4AF37]">GARV</span>
        </h2>

        {/* ALERTS */}
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 text-center border border-red-200">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-4 text-center border border-green-200">{message}</div>}

        {/* TAB NAVIGATION */}
        <div className="flex mb-6 border-b border-gray-200">
          <button 
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${authMethod === 'email' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-400 hover:text-black'}`}
            onClick={() => { setAuthMethod('email'); setError(''); setMessage(''); }}
          >
            Email
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${authMethod === 'phone' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-400 hover:text-black'}`}
            onClick={() => { setAuthMethod('phone'); setError(''); setMessage(''); }}
          >
            Phone (OTP)
          </button>
        </div>

        {/* EMAIL & PASSWORD FORM */}
        {authMethod === 'email' && (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              
              {/* NEW FIELDS: Only show if user is signing up */}
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                      type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input 
                      type="tel" required value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                      placeholder="+91 9811X XXXXX"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="w-full bg-[#111111] text-white p-3 rounded-md font-semibold hover:bg-black transition-colors shadow-md">
                {isLogin ? 'Sign In Securely' : 'Create Account'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-[#D4AF37] font-semibold hover:underline">
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>

            <div className="mt-6 flex items-center justify-between">
              <hr className="w-full border-gray-300" /><span className="px-3 text-gray-400 text-sm">OR</span><hr className="w-full border-gray-300" />
            </div>

            <button onClick={handleGoogleAuth} className="w-full mt-6 flex items-center justify-center gap-3 border border-gray-300 p-3 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors">
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
                    type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                    placeholder="9811X XXXXX"
                  />
                </div>
                <button type="submit" className="w-full bg-[#111111] text-white p-3 rounded-md font-semibold hover:bg-black transition-colors shadow-md">
                  Send OTP via SMS
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-Digit OTP</label>
                  <input 
                    type="text" required maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none tracking-widest text-center text-lg"
                    placeholder="------"
                  />
                </div>
                <button type="submit" className="w-full bg-[#D4AF37] text-white p-3 rounded-md font-semibold hover:bg-[#b5952f] transition-colors shadow-md">
                  Verify & Login
                </button>
                <button 
                  type="button" onClick={() => setOtpSent(false)} 
                  className="w-full text-sm text-gray-500 hover:text-black mt-2"
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
