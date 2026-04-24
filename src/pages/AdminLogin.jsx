import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await login(email, password);
      navigate('/garv-secure-admin'); // If successful, teleport to the admin panel!
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Admin Portal</h2>
        <p style={styles.subtitle}>Enter your credentials to manage inventory.</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <input 
            type="email" 
            placeholder="Admin Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required 
          />
          <button type="submit" style={styles.button}>Secure Login</button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' },
  card: { backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', border: '1px solid #E5E7EB' },
  title: { margin: '0 0 10px 0', color: '#1A1A1A', fontSize: '1.8rem', textAlign: 'center' },
  subtitle: { margin: '0 0 24px 0', color: '#666', textAlign: 'center', fontSize: '0.9rem' },
  errorBox: { backgroundColor: '#FEE2E2', color: '#DC2626', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', textAlign: 'center', border: '1px solid #F87171' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  input: { padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9F8F6', fontSize: '1rem', color: '#1A1A1A', outline: 'none' },
  button: { padding: '16px', backgroundColor: '#0F4C5C', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '10px' }
};

export default AdminLogin;