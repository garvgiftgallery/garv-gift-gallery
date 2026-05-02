import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse'; 
import DOMPurify from 'dompurify';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // --- Core States ---
  const [activeTab, setActiveTab] = useState('inventory'); 
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // --- UI & Action States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState('list'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // --- Drawer States ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); 
  const [selectedItem, setSelectedItem] = useState(null); 

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const prodSnap = await getDocs(collection(db, 'products'));
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const ordSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      setOrders(ordSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const custSnap = await getDocs(collection(db, 'customers'));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin-portal-access');
  };

  // --- 🚪 Drawer Handlers ---
  const openDrawer = (type, item = null) => {
    setDrawerType(type);
    if (type === 'product') {
      // ✨ ADDED: stock, category, tagsInput fields
      setSelectedItem(item || { 
        name: '', retail: 0, ws: 0, bulk: 0, retailMoq: 1, wsMoq: 1, bulkMoq: 1, 
        packSize: 1, stock: 100, category: '', tagsInput: '', desc: '', images: [], variantLabel: '', variants: [] 
      });
    } else if (type === 'customer') {
      setSelectedItem(item || { name: '', email: '', phone: '', tier: 'retail', status: 'active' });
    }
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      setDrawerType(null);
      setSelectedItem(null);
    }, 300);
  };

  // --- 🗑️ Delete Data ---
  const handleDelete = async (collectionName, id) => {
    let itemName = 'item';
    if (collectionName === 'products') itemName = 'product';
    if (collectionName === 'customers') itemName = 'customer';
    if (collectionName === 'orders') itemName = 'order';

    const isConfirmed = window.confirm(`Are you absolutely sure you want to delete this ${itemName}? This cannot be undone.`);
    if (!isConfirmed) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, collectionName, id));
      await fetchData();
      closeDrawer();
    } catch (err) {
      alert(`Error deleting ${itemName}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 📝 Update Order Status ---
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      await fetchData();
    } catch (err) {
      alert('Error updating order status');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 👤 Save Customer ---
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (selectedItem.id) {
        const custRef = doc(db, 'customers', selectedItem.id);
        await updateDoc(custRef, {
          name: selectedItem.name,
          phone: selectedItem.phone,
          tier: selectedItem.tier,
          status: selectedItem.status || 'active'
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          name: selectedItem.name,
          email: selectedItem.email.toLowerCase(),
          phone: selectedItem.phone,
          tier: selectedItem.tier,
          status: 'pre_approved',
          createdAt: serverTimestamp()
        });
      }
      await fetchData();
      closeDrawer();
    } catch (err) {
      alert('Error saving customer');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 📦 Save Product ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const validVariants = (selectedItem.variants || []).filter(v => v.name && v.name.trim() !== '');
      
      // ✨ ADDED: Parse tags from comma separated string
      const tagsArray = selectedItem.tagsInput 
        ? selectedItem.tagsInput.split(',').map(t => DOMPurify.sanitize(t.trim())).filter(t => t) 
        : (selectedItem.tags || []);

      const productData = {
        name: DOMPurify.sanitize(selectedItem.name || ''),
        desc: DOMPurify.sanitize(selectedItem.desc || ''),
        category: DOMPurify.sanitize(selectedItem.category || selectedItem.cat || ''), // ✨ ADDED: Main category
        tags: tagsArray, // ✨ ADDED: Hidden search array
        stock: Number(selectedItem.stock) || 0, // ✨ ADDED: Stock
        retail: Number(selectedItem.retail) || 0,
        ws: Number(selectedItem.ws) || 0,
        bulk: Number(selectedItem.bulk) || 0,
        retailMoq: Number(selectedItem.retailMoq) || 1,
        wsMoq: Number(selectedItem.wsMoq) || 1,
        bulkMoq: Number(selectedItem.bulkMoq) || 1,
        packSize: Number(selectedItem.packSize) || 1,
        images: selectedItem.images || [], 
        
        variantLabel: validVariants.length > 0 ? DOMPurify.sanitize(selectedItem.variantLabel || 'Option') : '',
        variants: validVariants.map(v => ({ 
          name: DOMPurify.sanitize(v.name.trim()),
          retail: v.retail ? Number(v.retail) : null,
          ws: v.ws ? Number(v.ws) : null,
          bulk: v.bulk ? Number(v.bulk) : null
        })),

        updatedAt: serverTimestamp()
      };

      if (selectedItem.id) {
        await updateDoc(doc(db, 'products', selectedItem.id), productData);
      } else {
        await addDoc(collection(db, 'products'), { ...productData, createdAt: serverTimestamp() });
      }
      
      await fetchData();
      closeDrawer();
    } catch (err) {
      alert('Error saving product');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 📸 MULTIPLE IMAGE MANAGEMENT ---
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    setIsProcessing(true);
    try {
      const newImageUrls = [];
      for (const file of files) {
        const storageRef = ref(storage, `product-images/${Date.now()}-${file.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const url = await getDownloadURL(uploadTask.ref);
        newImageUrls.push(url);
      }
      setSelectedItem(prev => ({ 
        ...prev, 
        images: [...(prev.images || []), ...newImageUrls] 
      }));
    } catch (error) {
      console.error("Upload error: ", error);
      alert('Upload failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setSelectedItem(prev => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove)
    }));
  };

  // --- ✨ VARIANT MANAGEMENT ---
  const handleAddVariant = () => {
    setSelectedItem(prev => ({ 
      ...prev, 
      variants: [...(prev.variants || []), { name: '', retail: '', ws: '', bulk: '' }] 
    }));
  };

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...(selectedItem.variants || [])];
    newVariants[index][field] = value;
    setSelectedItem(prev => ({ ...prev, variants: newVariants }));
  };

  const handleRemoveVariant = (index) => {
    setSelectedItem(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  // --- ⬇️ Bulk Import CSV ---
  const handleBulkImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          let count = 0;
          
          results.data.forEach((row) => {
            if (!row.name && !row.title) return; 
            const safeTitle = DOMPurify.sanitize(row.name || row.title);
            const existingProduct = products.find(p => (p.name || p.title || "").toLowerCase() === safeTitle.toLowerCase());
            const docRef = existingProduct ? doc(db, 'products', existingProduct.id) : doc(collection(db, 'products')); 
            
            const imageArray = row.imageUrl || row.image ? [DOMPurify.sanitize(row.imageUrl || row.image)] : [];
            // ✨ ADDED: Parse tags and category
            const tagsArray = row.tags ? row.tags.split(',').map(t => DOMPurify.sanitize(t.trim())).filter(t => t) : [];

            batch.set(docRef, {
              name: safeTitle,
              retail: Number(row.retail) || 0,
              ws: Number(row.ws || row.wholesalePrice) || 0,
              bulk: Number(row.bulk || row.bulkPrice) || 0,
              retailMoq: Number(row.retailMoq || row.moq) || 1,
              wsMoq: Number(row.wsMoq || row.moq) || 1,
              bulkMoq: Number(row.bulkMoq || row.moq) || 1,
              packSize: Number(row.packSize) || 1,
              stock: Number(row.stock) || 0, // ✨ ADDED: Read stock from CSV
              desc: DOMPurify.sanitize(row.desc || row.description || ""),
              category: DOMPurify.sanitize(row.category || row.cat || ""), // ✨ ADDED
              tags: tagsArray, // ✨ ADDED
              images: imageArray, 
            }, { merge: true }); 
            count++;
          });

          await batch.commit(); 
          alert(`✅ Successfully processed ${count} products!`);
          fetchData();
        } catch (error) {
          console.error("Bulk Import Error:", error);
          alert('❌ Failed to process CSV.');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handleExportCSV = (data, filename) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportProducts = () => {
    const exportData = products.map(p => ({
      ID: p.id, Name: p.name, Category: p.category || p.cat, Tags: (p.tags || []).join(', '), Stock: p.stock || 0,
      Retail_Price: p.retail, WS_Price: p.ws, Bulk_Price: p.bulk,
      Retail_MOQ: p.retailMoq, WS_MOQ: p.wsMoq, Bulk_MOQ: p.bulkMoq, Pack_Size: p.packSize,
      Description: p.desc, 
      Variant_Label: p.variantLabel || '',
      Variants: (p.variants || []).map(v => v.name).join(' | '),
      Images: (p.images || []).join(', ')
    }));
    handleExportCSV(exportData, 'GARV_Inventory');
  };

  const exportCustomers = () => {
    const exportData = customers.map(c => ({
      ID: c.id, Name: c.name, Email: c.email, Phone: c.phone, Tier: c.tier, Status: c.status || 'active'
    }));
    handleExportCSV(exportData, 'GARV_Customers');
  };

  // --- ✨ UPDATED Filtering (Includes tags) ---
  const filteredProducts = products
    .filter(p => {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || 
             (p.category || p.cat || '').toLowerCase().includes(q) ||
             (p.tags || []).some(t => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'priceAsc') return a.retail - b.retail;
      if (sortBy === 'priceDesc') return b.retail - a.retail;
      if (sortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
      return 0; 
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative bg-[#F9F8F6] min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-6 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight uppercase">Control Center</h2>
          <p className="text-gray-500 text-sm mt-1">Manage inventory, orders, and CRM securely.</p>
        </div>
        <button onClick={handleLogout} className="mt-4 md:mt-0 bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-semibold hover:bg-gray-50 transition">
          Sign Out
        </button>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 overflow-x-auto pb-4 mb-6 hide-scrollbar">
        {['inventory', 'orders', 'customers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-md text-sm font-bold capitalize whitespace-nowrap transition-all ${
              activeTab === tab ? 'bg-[#111111] text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-900'
            }`}
          >
            {tab} ({tab === 'inventory' ? products.length : tab === 'orders' ? orders.length : customers.length})
          </button>
        ))}
      </div>

      {/* TAB CONTENT: INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex w-full md:w-auto gap-2">
              <input type="text" placeholder="Search products or tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm bg-white cursor-pointer">
                <option value="newest">Newest</option>
                <option value="nameAsc">A - Z</option>
                <option value="priceAsc">Price: Low to High</option>
                <option value="priceDesc">Price: High to Low</option>
              </select>
            </div>
            
            <div className="flex w-full md:w-auto gap-2">
              <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-200 hidden md:block transition-colors">
                {viewMode === 'grid' ? '☰ List' : '⊞ Grid'}
              </button>
              <button onClick={exportProducts} className="flex-1 md:flex-none px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-bold hover:bg-green-100 transition shadow-sm">
                ⬇️ Export CSV
              </button>
              <label className="flex-1 md:flex-none px-4 py-2 bg-[#111111] text-white rounded-md text-sm font-bold hover:bg-black transition cursor-pointer text-center shadow-sm">
                {isProcessing ? '⏳...' : '⬆️ Import CSV'}
                <input type="file" accept=".csv" className="hidden" onChange={handleBulkImport} disabled={isProcessing} />
              </label>
              <button onClick={() => openDrawer('product')} className="flex-1 md:flex-none px-4 py-2 bg-[#D4AF37] text-white rounded-md text-sm font-bold hover:bg-[#b5952f] transition shadow-sm">
                + Add New
              </button>
            </div>
          </div>

          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
            {filteredProducts.map(product => (
              // ✨ ADDED: Opacity change if out of stock
              <div key={product.id} onClick={() => openDrawer('product', product)} className={`bg-white rounded-xl border border-gray-100 shadow-sm hover:border-[#D4AF37] transition flex cursor-pointer ${viewMode === 'grid' ? 'flex-col p-4' : 'flex-row justify-between items-center p-3'} ${product.stock <= 0 ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-4 flex-1">
                  {viewMode === 'list' && (
                    <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 relative">
                      {product.images && product.images.length > 0 ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Img</div>}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-gray-900 line-clamp-1 flex items-center gap-2">
                      {product.name || 'Unnamed'} 
                      {product.variants?.length > 0 && <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">+{product.variants.length} Options</span>}
                      {/* ✨ ADDED: Out of Stock Badge */}
                      {product.stock <= 0 && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold tracking-wider">OUT OF STOCK</span>}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-[#F9F8F6] border border-[#D4AF37] px-2 py-0.5 rounded text-[#D4AF37] font-bold uppercase tracking-wider">{product.category || product.cat || 'UNTAGGED'}</span>
                      {viewMode === 'list' && <span className="text-xs text-gray-500">Retail: ₹{product.retail} | WS: ₹{product.ws} | Stock: {product.stock || 0}</span>}
                    </div>
                  </div>
                </div>
                <div className={`${viewMode === 'grid' ? 'mt-4 border-t border-gray-100 pt-3' : ''} flex justify-between items-center gap-2`}>
                  {viewMode === 'grid' && (
                     <div className="flex flex-col">
                       <span className="text-xs text-gray-500">Retail: ₹{product.retail}</span>
                       <span className="text-xs text-gray-500">WS: ₹{product.ws}</span>
                       <span className="text-xs font-semibold text-gray-700">Stock: {product.stock || 0}</span>
                     </div>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md font-semibold">Edit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm text-center text-gray-500">
              No orders found.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {orders.map((order) => (
                <div key={order.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden transition hover:border-[#D4AF37]">
                  
                  {/* Order Header */}
                  <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 tracking-tight">Order #{order.id.slice(0, 6).toUpperCase()}</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${order.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                      {order.status === 'pending_whatsapp' ? 'Pending' : order.status}
                    </span>
                  </div>
                  
                  {/* Customer Info */}
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Customer:</span> {order.customerName}
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Phone:</span> {order.customerPhone}
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Tier:</span> 
                      <span className="text-[#D4AF37] font-bold uppercase text-[10px] bg-[#F9F8F6] px-2 py-0.5 rounded border border-[#D4AF37]">
                        {order.tierPlacedAt || 'Retail'}
                      </span>
                    </p>
                  </div>

                  {/* Order Items Receipt */}
                  <div className="bg-[#F9F8F6] p-4 rounded-lg border border-gray-200 mt-auto">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-3 tracking-wider">Itemized Receipt</p>
                    <ul className="text-sm space-y-2 mb-3">
                      {order.items?.map((item, idx) => (
                        <li key={idx} className="flex justify-between items-start gap-4">
                          <span className="text-gray-700 leading-tight">
                            <span className="font-semibold text-gray-900">{item.quantity}x</span> {item.title}
                          </span>
                          <span className="font-medium text-gray-900 whitespace-nowrap">
                            ₹{item.pricePaid * item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-3 border-t border-gray-300 flex justify-between items-center">
                      <span className="font-bold text-gray-900 uppercase text-xs tracking-wider">Total Paid</span>
                      <span className="font-bold text-xl text-[#111111]">₹{order.totalAmount}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    {order.status === 'pending_whatsapp' && (
                      <button onClick={() => handleUpdateOrderStatus(order.id, 'accepted')} disabled={isProcessing} className="flex-1 bg-black text-white py-2 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition shadow-sm disabled:opacity-50">
                        Accept Order
                      </button>
                    )}
                    {order.status === 'accepted' && (
                      <button disabled className="flex-1 bg-green-50 text-green-700 border border-green-200 py-2 rounded-md text-xs font-bold uppercase tracking-wider opacity-80 cursor-not-allowed">
                        Accepted ✅
                      </button>
                    )}
                    <button onClick={() => handleDelete('orders', order.id)} disabled={isProcessing} className="flex-1 bg-white text-red-600 border border-red-200 py-2 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition shadow-sm disabled:opacity-50">
                      Delete
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: CRM */}
      {activeTab === 'customers' && (
        <div className="space-y-8">
          
          <div className="flex justify-end gap-2 mb-2">
            <button onClick={exportCustomers} className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-bold hover:bg-green-100 transition shadow-sm">
              ⬇️ Export Customers
            </button>
            <button onClick={() => openDrawer('customer')} className="px-4 py-2 bg-[#D4AF37] text-white rounded-md text-sm font-bold hover:bg-[#b5952f] transition shadow-sm">
              + Add Customer
            </button>
          </div>

          {/* APPROVAL INBOX */}
          {customers.filter(c => c.status === 'pending').length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-orange-800 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                Pending Verification Requests
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.filter(c => c.status === 'pending').map((cust) => (
                  <div key={cust.id} className="bg-white p-5 rounded-xl border border-orange-200 shadow-sm flex flex-col justify-between relative">
                    <div className="mb-4">
                      <h4 className="font-bold text-gray-900">{cust.name}</h4>
                      <p className="text-sm text-gray-500">{cust.email}</p>
                      <p className="text-xs text-gray-400 mt-1">{cust.phone || 'No Phone'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedItem({...cust, status: 'active', tier: 'wholesale'});
                          openDrawer('customer', {...cust, status: 'active', tier: 'wholesale'});
                        }} 
                        className="flex-1 bg-[#111111] text-white text-xs font-bold py-2 rounded hover:bg-black transition uppercase"
                      >
                        Review & Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE ROSTER */}
          <div>
            <h3 className="text-gray-900 font-bold uppercase tracking-wider mb-4">Active Roster</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.filter(c => c.status !== 'pending').map((cust) => (
                <div key={cust.id} onClick={() => openDrawer('customer', cust)} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:border-[#D4AF37] transition flex justify-between items-center relative overflow-hidden">
                  {cust.status === 'pre_approved' && (
                    <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[9px] font-bold px-2 py-1 uppercase rounded-bl-lg">
                      Pre-Approved
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-gray-900">{cust.name || 'Valued Customer'}</h4>
                    <p className="text-sm text-gray-500">{cust.email}</p>
                    <p className="text-xs text-gray-400 mt-1">{cust.phone || 'No Phone'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    cust.tier === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : 
                    cust.tier === 'wholesale' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    cust.tier === 'bulk' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>
                    {cust.tier || 'Retail'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      )}


      {/* --- 🚀 THE SLIDE-OVER DRAWER --- */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm transition-opacity" onClick={closeDrawer}></div>
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#F9F8F6]">
              <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                {drawerType === 'product' ? (selectedItem?.id ? 'Edit Product' : 'New Product') : (selectedItem?.id ? 'Edit Customer' : 'Pre-Approve Customer')}
              </h3>
              <button onClick={closeDrawer} className="text-gray-400 hover:text-black text-3xl leading-none">&times;</button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto hide-scrollbar">
              
              {/* --- PRODUCT FORM --- */}
              {drawerType === 'product' && (
                <form id="drawerForm" onSubmit={handleSaveProduct} className="space-y-5">
                  
                  {/* MULTIPLE IMAGE MANAGEMENT */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex flex-wrap gap-3 mb-3">
                      {selectedItem?.images?.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-300 shadow-sm">
                          <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:text-red-500 text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <label className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition">
                      <span className="text-sm font-semibold text-gray-500">{isProcessing ? 'Uploading...' : '+ Add Photos'}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isProcessing} />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Product Title</label>
                    <input required type="text" value={selectedItem?.name} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Base Retail</label>
                      <input required type="number" value={selectedItem?.retail} onChange={e => setSelectedItem({...selectedItem, retail: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Base WS</label>
                      <input required type="number" value={selectedItem?.ws} onChange={e => setSelectedItem({...selectedItem, ws: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Base Bulk</label>
                      <input required type="number" value={selectedItem?.bulk} onChange={e => setSelectedItem({...selectedItem, bulk: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ret MOQ</label>
                      <input required type="number" min="1" value={selectedItem?.retailMoq} onChange={e => setSelectedItem({...selectedItem, retailMoq: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">WS MOQ</label>
                      <input required type="number" min="1" value={selectedItem?.wsMoq} onChange={e => setSelectedItem({...selectedItem, wsMoq: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bulk MOQ</label>
                      <input required type="number" min="1" value={selectedItem?.bulkMoq} onChange={e => setSelectedItem({...selectedItem, bulkMoq: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none" />
                    </div>
                  </div>

                  {/* ✨ ADDED: Category & Stock Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Main Category (Pill)</label>
                      <input type="text" placeholder="e.g. Lamps" value={selectedItem?.category || selectedItem?.cat || ''} onChange={e => setSelectedItem({...selectedItem, category: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Stock Qty</label>
                      <input required type="number" min="0" value={selectedItem?.stock} onChange={e => setSelectedItem({...selectedItem, stock: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                    </div>
                  </div>

                  {/* ✨ ADDED: Tags & Pack Size Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tags (Comma Separated)</label>
                      <input type="text" placeholder="e.g. brass, gift, diwali" value={selectedItem?.tagsInput || (selectedItem?.tags ? selectedItem.tags.join(', ') : '')} onChange={e => setSelectedItem({...selectedItem, tagsInput: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pack Size</label>
                      <input type="number" min="1" value={selectedItem?.packSize} onChange={e => setSelectedItem({...selectedItem, packSize: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                    </div>
                  </div>

                  {/* ✨ SPRINT 4.5: DYNAMIC VARIANTS WITH OPTIONAL PRICING */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold text-gray-700 uppercase">Variants (Optional)</label>
                      <button type="button" onClick={handleAddVariant} className="text-[10px] bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-100 font-bold uppercase tracking-wider shadow-sm">
                        + Add Option
                      </button>
                    </div>

                    {selectedItem?.variants?.length > 0 ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Variant Category Label (e.g., Color, Finish, Size)</label>
                          <input type="text" placeholder="e.g., Finish" value={selectedItem?.variantLabel || ''} onChange={e => setSelectedItem({...selectedItem, variantLabel: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-[10px] text-gray-400 italic mb-1 leading-tight">Leave prices blank to inherit base product prices.</p>
                          {selectedItem.variants.map((variant, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-md shadow-sm">
                              <div className="flex gap-2 items-center">
                                <input type="text" placeholder={`Option ${idx + 1} Name (e.g. Rose Gold)`} value={variant.name} onChange={e => handleVariantChange(idx, 'name', e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" required />
                                <button type="button" onClick={() => handleRemoveVariant(idx)} className="text-red-400 hover:text-red-600 font-bold px-2 text-lg leading-none" title="Remove Option">
                                  &times;
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[9px] font-bold text-gray-500 uppercase">Ret (Opt)</label>
                                  <input type="number" placeholder="₹" value={variant.retail || ''} onChange={e => handleVariantChange(idx, 'retail', e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-[11px] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-gray-500 uppercase">WS (Opt)</label>
                                  <input type="number" placeholder="₹" value={variant.ws || ''} onChange={e => handleVariantChange(idx, 'ws', e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-[11px] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-gray-500 uppercase">Bulk (Opt)</label>
                                  <input type="number" placeholder="₹" value={variant.bulk || ''} onChange={e => handleVariantChange(idx, 'bulk', e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-[11px] focus:outline-none" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 italic mt-2">No variants. This product will be sold as a single standard item.</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                    <textarea rows="3" value={selectedItem?.desc} onChange={e => setSelectedItem({...selectedItem, desc: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"></textarea>
                  </div>
                </form>
              )}

              {/* --- CUSTOMER CRM FORM --- */}
              {drawerType === 'customer' && (
                <form id="drawerForm" onSubmit={handleSaveCustomer} className="space-y-5">
                  {selectedItem?.id ? (
                    <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Account ID</p>
                      <p className="text-sm font-mono text-gray-900 truncate">{selectedItem?.id}</p>
                    </div>
                  ) : (
                    <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
                      <p className="text-sm text-blue-800 font-medium">
                        Pre-approve a client. When they sign up with this email, they will instantly receive the Tier you assign below.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address</label>
                    <input required type="email" disabled={!!selectedItem?.id} value={selectedItem?.email} onChange={e => setSelectedItem({...selectedItem, email: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-100" placeholder="client@company.com" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name / Company</label>
                    <input required type="text" value={selectedItem?.name} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
                    <input type="text" value={selectedItem?.phone} onChange={e => setSelectedItem({...selectedItem, phone: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pricing Tier</label>
                      <select value={selectedItem?.tier} onChange={e => setSelectedItem({...selectedItem, tier: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none cursor-pointer">
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="bulk">Bulk</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Account Status</label>
                      <select value={selectedItem?.status || 'active'} onChange={e => setSelectedItem({...selectedItem, status: e.target.value})} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none cursor-pointer">
                        <option value="active">Active (Approved)</option>
                        <option value="pending">Pending</option>
                        <option value="pre_approved">Pre-Approved</option>
                      </select>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-white flex flex-col gap-3">
              <button 
                type="submit" form="drawerForm" disabled={isProcessing}
                className="w-full bg-[#111111] text-white py-3.5 rounded-md font-bold hover:bg-black transition shadow-md disabled:opacity-50 uppercase tracking-wide"
              >
                {isProcessing ? 'Saving...' : `Save ${drawerType}`}
              </button>
              
              {selectedItem?.id && (
                 <button 
                   type="button" onClick={() => handleDelete(drawerType === 'product' ? 'products' : 'customers', selectedItem.id)} disabled={isProcessing}
                   className="w-full bg-white text-red-600 border border-red-200 py-3 rounded-md font-bold hover:bg-red-50 transition disabled:opacity-50 uppercase tracking-wide text-sm"
                 >
                   Delete {drawerType}
                 </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;