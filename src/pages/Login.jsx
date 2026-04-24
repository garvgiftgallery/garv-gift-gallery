import { useState } from 'react';
import { auth, db } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [step, setStep] = useState(1); 
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); 
  const [referralCode, setReferralCode] = useState(''); 
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`; 
      
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      window.confirmationResult = confirmationResult; 
      setStep(2);
    } catch (err) {
      console.error(err);
      setError('Failed to send OTP. Please check your number.');
      if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await window.confirmationResult.confirm(otp);
      const user = result.user;

      const userDocRef = doc(db, 'customers', user.phoneNumber);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        let assignedTier = 'retail';
        if (referralCode.trim() === 'GARV-WS-2026') assignedTier = 'wholesale';
        if (referralCode.trim() === 'GARV-BLK-99') assignedTier = 'bulk';

        await setDoc(userDocRef, {
          name: name || 'Valued Customer',
          phone: user.phoneNumber,
          email: email || '',
          tier: assignedTier,
          joinedAt: serverTimestamp(),
          lastOrderDate: null
        });
      }
      
      navigate('/cart');

    } catch (err) {
      console.error(err);
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>{step === 1 ? 'Welcome Back' : 'Verify Access'}</h2>
          <p style={styles.subtitle}>
            {step === 1 
              ? 'Enter your mobile number to view premium pricing and checkout.' 
              : `Secure OTP sent to ${phone}`
            }
          </p>
        </div>
        
        {error && <div style={styles.errorBox}>{error}</div>}
        <div id="recaptcha-container"></div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Mobile Number</label>
              <input 
                type="tel" 
                placeholder="e.g. 9876543210" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                style={styles.input} 
                required 
              />
            </div>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Securing Connection...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>6-Digit OTP</label>
              <input 
                type="text" 
                placeholder="• • • • • •" 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)} 
                style={{...styles.input, letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem'}} 
                required 
              />
            </div>
            
            <div style={styles.divider}>
              <span style={styles.line}></span>
              <span style={{ padding: '0 12px' }}>New Partner Details (Optional)</span>
              <span style={styles.line}></span>
            </div>
            
            <div style={styles.inputGroup}>
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
            </div>
            
            <div style={styles.inputGroup}>
              <input type="text" placeholder="Partner Referral Code" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} style={styles.accentInput} />
            </div>

            <button type="submit" style={{...styles.button, marginTop: '8px'}} disabled={loading}>
              {loading ? 'Verifying...' : 'Authenticate & Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const styles = {
  wrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '20px' },
  card: { backgroundColor: '#FFF', padding: '40px', borderRadius: '8px', width: '100%', maxWidth: '420px', border: '1px solid #EAEAEA', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', boxSizing: 'border-box' },
  
  header: { textAlign: 'center', marginBottom: '32px' },
  title: { margin: '0 0 8px 0', color: '#111', fontSize: '1.5rem', fontWeight: '600', letterSpacing: '-0.5px' },
  subtitle: { margin: 0, color: '#666', fontSize: '0.9rem', lineHeight: '1.4' },
  
  errorBox: { backgroundColor: '#FEF2F2', color: '#991B1B', padding: '12px', borderRadius: '6px', marginBottom: '24px', fontSize: '0.85rem', border: '1px solid #FEE2E2', textAlign: 'center', fontWeight: '500' },
  
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.75rem', fontWeight: '600', color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px' },
  
  input: { padding: '14px 16px', borderRadius: '6px', border: '1px solid #EAEAEA', backgroundColor: '#FAFAFA', fontSize: '0.95rem', color: '#111', outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box' },
  accentInput: { padding: '14px 16px', borderRadius: '6px', border: '1px solid #EAEAEA', backgroundColor: '#F9FAFB', fontSize: '0.95rem', color: '#111', outline: 'none', width: '100%', boxSizing: 'border-box' },
  
  button: { padding: '14px', backgroundColor: '#111', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', transition: 'opacity 0.2s', width: '100%', boxSizing: 'border-box' },
  
  divider: { display: 'flex', alignItems: 'center', textAlign: 'center', margin: '8px 0', color: '#888', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' },
  line: { flex: 1, borderBottom: '1px solid #EAEAEA' }
};

export default Login;