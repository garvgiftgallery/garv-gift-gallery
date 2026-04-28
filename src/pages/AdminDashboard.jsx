import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, arrayUnion, query, orderBy, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse'; 
import DOMPurify from 'dompurify'; // 🛡️ ADDED: The security sanitizer

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('inventory'); 
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prodSnap = await getDocs(collection(db, 'products'));
        setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const ordSnap = await getDocs(ordersQuery);
        setOrders(ordSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const custSnap = await getDocs(collection(db, 'customers'));
        setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching admin data: ", error);
      }
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin-portal-access');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    return timestamp.toDate().toLocaleString('en-IN', { 
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  // --- 📸 IMAGE UPLOAD ---
  const handleMultiImageUpload = async (event, productId) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      setUploadingId(productId);
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `product-images/${productId}-${Date.now()}-${file.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        return getDownloadURL(uploadTask.ref);
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const productDocRef = doc(db, 'products', productId);
      
      await updateDoc(productDocRef, { images: arrayUnion(...uploadedUrls) });
      alert(`✅ Successfully uploaded ${files.length} image(s)!`);
      window.location.reload(); 
    } catch (error) {
      console.error("Error uploading: ", error);
      alert('❌ Upload failed. Check console.');
    } finally {
      setUploadingId(null);
    }
  };

  // --- ⬇️ EXPORT CSV FUNCTIONS ---
  const handleExportInventory = () => {
    const csv = Papa.unparse(products);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'GARV_Inventory_Export.csv';
    link.click();
  };

  const handleExportCustomers = () => {
    const csv = Papa.unparse(customers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'GARV_CRM_Export.csv';
    link.click();
  };

  // --- ⬆️ BULK IMPORT (UPSERT) FUNCTION WITH SANITIZATION ---
  const handleBulkImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsProcessingCsv(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        try {
          const batch = writeBatch(db);
          let count = 0;

          data.forEach((row) => {
            if (!row.name && !row.title) return; 
            
            // 🛡️ SANITIZE STRINGS TO PREVENT XSS ATTACKS
            const rawTitle = row.name || row.title;
            const safeTitle = DOMPurify.sanitize(rawTitle);
            const safeDesc = DOMPurify.sanitize(row.desc || row.description || "No description provided.");
            const safeCat = DOMPurify.sanitize(row.cat || row.tags || "");
            const safeImageUrl = DOMPurify.sanitize(row.imageUrl || row.image || "");
            
            const existingProduct = products.find(p => {
              const pTitle = p.name || p.title || "";
              return pTitle.toLowerCase() === safeTitle.toLowerCase();
            });
            
            let docRef;
            if (existingProduct) {
              docRef = doc(db, 'products', existingProduct.id); 
            } else {
              docRef = doc(collection(db, 'products')); 
            }

            batch.set(docRef, {
              name: safeTitle,
              retail: Number(row.retail) || 0,
              ws: Number(row.ws || row.wholesalePrice) || 0,
              bulk: Number(row.bulk || row.bulkPrice) || 0,
              moq: Number(row.moq) || 1,
              packSize: Number(row.packSize) || 1,
              desc: safeDesc,
              cat: safeCat,
              imageUrl: safeImageUrl, 
            }, { merge: true }); 
            
            count++;
          });

          await batch.commit(); 
          alert(`✅ Successfully imported/updated ${count} products!`);
          window.location.reload();

        } catch (error) {
          console.error("Bulk Import Error:", error);
          alert('❌ Failed to process CSV. Check console.');
        } finally {
          setIsProcessingCsv(false);
        }
      }
    });
  };

  return (
    <div style={styles.container}>
      
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Control Center</h2>
          <p style={styles.subtitle}>Manage inventory, orders, and client relations.</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sign Out</button>
      </div>

      {/* Tabs */}
      <div style={styles.tabContainer}>
        <button style={activeTab === 'inventory' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('inventory')}>
          Inventory ({products.length})
        </button>
        <button style={activeTab === 'orders' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('orders')}>
          Orders ({orders.length})
        </button>
        <button style={activeTab === 'customers' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('customers')}>
          CRM ({customers.length})
        </button>
      </div>

      {/* VIEW: INVENTORY */}
      {activeTab === 'inventory' && (
        <div style={styles.list}>
          
          <div style={styles.actionBox}>
            <button onClick={handleExportInventory} style={styles.actionBtn}>
              ⬇️ Export CSV
            </button>
            <label style={{...styles.actionBtn, backgroundColor: '#111', color: '#FFF', border: 'none'}}>
              {isProcessingCsv ? '⏳ Processing...' : '⬆️ Bulk Import / Update'}
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleBulkImport} disabled={isProcessingCsv} />
            </label>
          </div>

          {products.map((product) => (
            <div key={product.id} style={styles.cardRow}>
              <div>
                <h4 style={styles.cardTitle}>{product.name || product.title || 'Unnamed Product'}</h4>
                <p style={styles.cardMeta}>₹{product.retail || 0} • Photos: {product.images ? product.images.length : (product.imageUrl ? 1 : 0)}</p>
              </div>
              
              {uploadingId === product.id ? (
                <span style={{ fontWeight: '600', color: '#666', fontSize: '0.85rem' }}>Uploading... ⏳</span>
              ) : (
                <label style={styles.cameraBtn}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '6px'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Photos
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleMultiImageUpload(e, product.id)} />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VIEW: ORDERS */}
      {activeTab === 'orders' && (
        <div style={styles.list}>
          {orders.length === 0 ? <p style={styles.emptyState}>No orders found.</p> : orders.map((order) => (
            <div key={order.id} style={styles.cardCol}>
              <div style={styles.orderHeader}>
                <h4 style={styles.cardTitle}>{order.customerName || 'Guest'}</h4>
                <span style={styles.tierBadge}>{order.tierPlacedAt || 'RETAIL'}</span>
              </div>
              <p style={styles.cardMeta}>{order.customerPhone} • {formatDate(order.createdAt)}</p>
              
              <div style={styles.orderItemsBox}>
                {(order.items || []).map((item, idx) => (
                  <div key={idx} style={styles.orderItemRow}>
                    <span>{item.quantity}x {item.title}</span>
                    <span style={{fontWeight: '600'}}>₹{item.pricePaid * item.quantity}</span>
                  </div>
                ))}
              </div>
              
              <div style={styles.orderFooter}>
                <span>Order Total</span>
                <span style={{fontSize: '1.1rem', fontWeight: '700', color: '#111'}}>₹{order.totalAmount}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW: CUSTOMERS */}
      {activeTab === 'customers' && (
        <div style={styles.list}>
          <div style={styles.actionBox}>
            <button onClick={handleExportCustomers} style={styles.actionBtn}>
              ⬇️ Export CRM Data
            </button>
          </div>

          {customers.length === 0 ? <p style={styles.emptyState}>No customers found.</p> : customers.map((customer) => (
            <div key={customer.id} style={styles.cardRow}>
              <div>
                <h4 style={styles.cardTitle}>{customer.name || 'Unnamed User'}</h4>
                <p style={{ margin: '2px 0 0 0', color: '#111', fontWeight: '600', fontSize: '0.9rem' }}>{customer.phone || customer.id}</p>
                <p style={styles.cardMeta}>Joined: {formatDate(customer.joinedAt)}</p>
              </div>
              <span style={styles.tierBadge}>{customer.tier || 'RETAIL'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '40px 20px' },
  
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #EAEAEA', paddingBottom: '24px', marginBottom: '24px' },
  title: { margin: '0 0 4px 0', color: '#111', fontSize: '1.6rem', fontWeight: '700', letterSpacing: '-0.5px' },
  subtitle: { margin: 0, color: '#666', fontSize: '0.95rem' },
  logoutBtn: { backgroundColor: '#FFF', color: '#111', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' },
  
  tabContainer: { display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #EAEAEA', paddingBottom: '12px' },
  tab: { padding: '8px 16px', backgroundColor: 'transparent', border: 'none', color: '#666', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.2s' },
  activeTab: { padding: '8px 16px', backgroundColor: '#111', border: 'none', borderRadius: '6px', color: '#FFF', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  
  actionBox: { display: 'flex', gap: '12px', backgroundColor: '#FAFAFA', padding: '16px', borderRadius: '8px', border: '1px solid #EAEAEA', marginBottom: '8px' },
  actionBtn: { flex: 1, padding: '10px 16px', backgroundColor: '#FFF', border: '1px solid #D1D5DB', borderRadius: '6px', color: '#111', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  
  /* Compact Row Card (Inventory, Customers) */
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: '16px 20px', borderRadius: '8px', border: '1px solid #EAEAEA' },
  cardTitle: { margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '600', color: '#111' },
  cardMeta: { margin: 0, fontSize: '0.8rem', color: '#666' },
  
  cameraBtn: { backgroundColor: '#FAFAFA', color: '#111', border: '1px solid #EAEAEA', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem', display: 'flex', alignItems: 'center' },
  tierBadge: { backgroundColor: '#F3F4F6', color: '#111', padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px', border: '1px solid #EAEAEA', textTransform: 'uppercase' },

  /* Compact Column Card (Orders) */
  cardCol: { display: 'flex', flexDirection: 'column', backgroundColor: '#FFF', padding: '20px', borderRadius: '8px', border: '1px solid #EAEAEA' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  orderItemsBox: { backgroundColor: '#FAFAFA', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0', border: '1px solid #EAEAEA' },
  orderItemRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#333' },
  orderFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #EAEAEA', paddingTop: '16px', fontSize: '0.9rem', color: '#666' },
  
  emptyState: { textAlign: 'center', padding: '40px', color: '#666', fontSize: '0.9rem', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px solid #EAEAEA' }
};

export default AdminDashboard;