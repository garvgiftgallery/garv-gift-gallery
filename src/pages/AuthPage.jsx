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
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'; 

const AuthPage = () => {
  const navigate = useNavigate();
  
  // Navigation & States
  const [authMethod, setAuthMethod] = useState('email'); 
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Email/Password States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Extra Sign-Up Details (Email)
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  
  // Phone OTP States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Onboarding States for Phone Auth
  const [isNewUserSetup, setIsNewUserSetup] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(null); 
  const [newUserName, setNewUserName] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');

  const ADMIN_EMAIL = "garvgiftgallery@gmail.com"; // Your Admin Email

  // Initialize invisible reCAPTCHA
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {}
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
        email: user.email || additionalData.email || '',
        phone: user.phoneNumber || additionalData.phone || '',
        tier: 'retail',         
        status: 'pending', // 🔒 strictly pending     
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
    setIsLoading(true); 

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userDocRef = doc(db, 'customers', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.exists() ? userDocSnap.data() : null;
        
        // 🔒 SECURITY GATE: Block login if status is pending
        if (userData?.status === 'pending' && user.email !== ADMIN_EMAIL) {
          await signOut(auth); // Kick them out instantly
          setError('Your account is currently under review. Please wait for Admin approval to log in.');
          setIsLoading(false);
          return;
        }

        if (!user.emailVerified && user.email !== ADMIN_EMAIL) {
          await sendEmailVerification(user); 
          await signOut(auth); 
          setError('Please verify your email using the link sent to your inbox.');
          setIsLoading(false);
          return;
        }

        window.location.href = '/'; // Successful login
      } else {
        if (!fullName.trim()) throw new Error('Full Name is required.');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: fullName.trim() });
        await ensureUserInDB(userCredential.user, { 
          name: fullName.trim(), 
          phone: contactNumber.trim(), 
          email: email.trim()
        });
        
        await sendEmailVerification(userCredential.user);
        await signOut(auth);

        setMessage('Account created! Please verify your email. An Admin will review your account shortly.');
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
      
      const userDocRef = doc(db, 'customers', result.user.uid);
      const docSnap = await getDoc(userDocRef);

      // 🔒 SECURITY GATE: Block login if status is pending
      if (docSnap.data()?.status === 'pending' && result.user.email !== ADMIN_EMAIL) {
        await signOut(auth); // Kick them out
        setError('Your account has been received and is pending Admin approval.');
        setIsLoading(false);
        return;
      }
      
      window.location.href = '/'; 
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
      setError('Failed to send OTP. Ensure phone format is correct.');
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
      const user = result.user;
      
      const docRef = doc(db, 'customers', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // 🔒 SECURITY GATE: Block returning user if status is pending
        if (docSnap.data().status === 'pending') {
          await signOut(auth);
          setError('Your account is currently under review. Please wait for Admin approval.');
          setIsLoading(false);
          return;
        }
        window.location.href = '/'; 
      } else {
        // New User -> Trigger Name Capture Flow
        setVerifiedUser(user);
        setIsNewUserSetup(true);
      }
    } catch (err) {
      setError('Invalid OTP code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle final step of New User Setup via Phone
  const handleCompleteSetup = async (e) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setIsLoading(true);
    try {
      await updateProfile(verifiedUser, { displayName: newUserName.trim() });

      // 🔒 SECURITY GATE: Save as strictly PENDING
      await setDoc(doc(db, 'customers', verifiedUser.uid), {
        name: newUserName.trim(),
        company: newUserCompany.trim() || '',
        phone: verifiedUser.phoneNumber || '',
        email: '',
        tier: 'retail',
        status: 'pending', // MUST BE PENDING
        createdAt: new Date()
      });

      // Sign out immediately so they can't access the site yet
      await signOut(auth);
      
      // Reset UI and show success message
      setIsNewUserSetup(false);
      setOtpSent(false);
      setPhoneNumber('');
      setOtp('');
      setMessage('Setup complete! Your account is now pending Admin approval.');
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100 relative overflow-hidden">
        
        {isNewUserSetup ? (
          <div className="animate-fade-in">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-2 tracking-wide text-black">
              Number Verified!
            </h2>
            <p className="text-center text-gray-500 text-sm mb-6">
              Just a few quick details to set up your account request.
            </p>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 text-center border border-red-200">{error}</div>}

            <form onSubmit={handleCompleteSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                <input 
                  disabled={isLoading} autoFocus
                  type="text" required value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Company / Shop Name <span className="text-gray-400 font-normal lowercase">(Optional)</span></label>
                <input 
                  disabled={isLoading}
                  type="text" value={newUserCompany} onChange={(e) => setNewUserCompany(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  placeholder="Gifts & Co."
                />
              </div>
              <button 
                type="submit" disabled={isLoading}
                className="w-full bg-[#D4AF37] text-white mt-4 p-3.5 rounded-md font-bold uppercase tracking-wider hover:bg-[#b5952f] transition-colors shadow-md disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Submit Request'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-6 tracking-wide text-black uppercase">
              Welcome to <span className="text-[#D4AF37]">GARV</span>
            </h2>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 text-center border border-red-200">{error}</div>}
            {message && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-4 text-center border border-green-200">{message}</div>}

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
                    type="submit" disabled={isLoading}
                    className="w-full bg-[#111111] text-white p-3 rounded-md font-semibold hover:bg-black transition-colors shadow-md disabled:opacity-50 flex justify-center items-center"
                  >
                    {isLoading ? 'Processing...' : (isLogin ? 'Sign In Securely' : 'Create Account')}
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
                  onClick={handleGoogleAuth} disabled={isLoading}
                  className="w-full mt-6 flex items-center justify-center gap-3 border border-gray-300 p-3 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
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
                    <button type="submit" disabled={isLoading} className="w-full bg-[#111111] text-white p-3 rounded-md font-semibold hover:bg-black transition-colors shadow-md disabled:opacity-50">
                      {isLoading ? 'Sending...' : 'Send OTP via SMS'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-Digit OTP</label>
                      <input 
                        disabled={isLoading} autoFocus
                        type="text" required maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none tracking-widest text-center text-lg disabled:bg-gray-50"
                        placeholder="------"
                      />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-[#D4AF37] text-white p-3 rounded-md font-semibold hover:bg-[#b5952f] transition-colors shadow-md disabled:opacity-50">
                      {isLoading ? 'Verifying...' : 'Verify & Login'}
                    </button>
                    <button type="button" disabled={isLoading} onClick={() => setOtpSent(false)} className="w-full text-sm text-gray-500 hover:text-black mt-2 disabled:opacity-50">
                      Change Phone Number
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuthPage;