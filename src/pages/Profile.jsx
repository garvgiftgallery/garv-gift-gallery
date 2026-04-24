import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { currentUser, userTier, logout } = useAuth();
  const [customerData, setCustomerData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchProfileData = async () => {
      try {
        const docRef = doc(db, 'customers', currentUser.phoneNumber);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCustomerData(docSnap.data());
        }

        const q = query(collection(db, 'orders'), where('customerPhone', '==', currentUser.phoneNumber));
        const orderSnap = await getDocs(q);
        setOrders(orderSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [currentUser, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading) return <div style={styles.emptyState}>Loading Profile...</div>;

  const customerName = customerData?.name || 'Valued Customer';
  const initial = customerName.charAt(0).toUpperCase();

  return (
    <div style={styles.container}>
      
      {/* Flattened, Compact VIP Card */}
      <div style={styles.membershipCard}>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Sign Out">
          Sign Out
        </button>

        <div style={styles.avatar}>{initial}</div>
        <h2 style={styles.name}>{customerName}</h2>
        <p style={styles.phone}>{currentUser.phoneNumber}</p>
        
        {(userTier === 'wholesale' || userTier === 'bulk') && (
          <div style={{ marginTop: '8px' }}>
            <span style={styles.tierBadge}>
              {userTier} Partner
            </span>
          </div>
        )}
      </div>

      <h3 style={styles.sectionTitle}>Order History</h3>
      
      {orders.length === 0 ? (
        <div style={styles.emptyState}>No orders found.</div>
      ) : (
        <div style={styles.orderList}>
          {orders.map((order, index) => (
            <div key={order.id} style={{
              ...styles.orderRow,
              borderBottom: index === orders.length - 1 ? 'none' : '1px solid #EAEAEA'
            }}>
              <div>
                <span style={styles.orderId}>Order #{order.id.slice(0, 6).toUpperCase()}</span>
                <p style={styles.orderMeta}>{order.items?.length || 0} items ordered</p>
              </div>
              <span style={styles.orderAmount}>₹{order.totalAmount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' },
  
  membershipCard: { 
    backgroundColor: '#FFF', 
    borderRadius: '8px', 
    border: '1px solid #EAEAEA', 
    padding: '24px', 
    marginBottom: '32px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    textAlign: 'center', 
    position: 'relative' 
  },
  logoutBtn: { 
    position: 'absolute', 
    top: '16px', 
    right: '16px', 
    backgroundColor: '#FAFAFA', 
    color: '#111', 
    border: '1px solid #EAEAEA', 
    padding: '4px 12px', 
    borderRadius: '4px', 
    fontSize: '0.75rem', 
    fontWeight: '500', 
    cursor: 'pointer'
  },
  avatar: { 
    width: '56px', 
    height: '56px', 
    backgroundColor: '#111', 
    color: '#FFF', 
    borderRadius: '50%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontSize: '1.4rem', 
    fontWeight: '600', 
    marginBottom: '12px'
  },
  name: { fontSize: '1.25rem', fontWeight: '600', color: '#111', margin: '0 0 4px 0', letterSpacing: '-0.3px' },
  phone: { fontSize: '0.85rem', color: '#666', margin: '0 0 12px 0' },
  
  tierBadge: { 
    display: 'inline-block',
    padding: '4px 12px', 
    borderRadius: '4px', 
    border: '1px solid #C5A059', 
    backgroundColor: '#FFFAF0', 
    color: '#B8860B', 
    fontSize: '0.7rem', 
    fontWeight: '700', 
    letterSpacing: '1px', 
    textTransform: 'uppercase'
  },
  
  sectionTitle: { fontSize: '1rem', fontWeight: '600', color: '#111', marginBottom: '12px', paddingLeft: '2px' },
  
  orderList: { display: 'flex', flexDirection: 'column', backgroundColor: '#FFF', borderRadius: '8px', border: '1px solid #EAEAEA', padding: '0 16px' },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' },
  orderId: { fontSize: '0.9rem', fontWeight: '500', color: '#111' },
  orderMeta: { fontSize: '0.8rem', color: '#888', marginTop: '2px', margin: 0 },
  orderAmount: { fontSize: '0.95rem', fontWeight: '600', color: '#111' },
  
  emptyState: { textAlign: 'center', padding: '32px', color: '#666', fontSize: '0.9rem', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px solid #EAEAEA' }
};

export default Profile;
