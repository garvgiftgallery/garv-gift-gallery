import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, writeBatch, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse'; 
import DOMPurify from 'dompurify';
import heic2any from 'heic2any'; 
import { useDropzone } from 'react-dropzone';
// ✨ ADDED: Import localforage for offline caching
import localforage from 'localforage';

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

  // --- CUSTOMER TAB STATES ---
  const [customerViewMode, setCustomerViewMode] = useState('grid');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSortBy, setCustomerSortBy] = useState('newest');

  // --- GLOBAL SETTINGS STATE ---
  const [hideOutOfStock, setHideOutOfStock] = useState(false);

  // --- Drawer States ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); 
  const [selectedItem, setSelectedItem] = useState(null); 

  useEffect(() => { 
    fetchData(); 
    fetchSettings();
  }, []);

  // --- ✨ ADDED: OFFLINE SYNC AGENT ---
  useEffect(() => {
    const handleOnline = async () => {
      console.log("Network restored. Processing offline image queue...");
      try {
        const keys = await localforage.keys();
        const offlineKeys = keys.filter(k => k.startsWith('offline_img_'));
        
        if (offlineKeys.length === 0) {
            console.log("No offline images to process.");
            return;
        }

        for (const key of offlineKeys) {
          const { file, localUrl, path } = await localforage.getItem(key);
          console.log(`Uploading delayed image to: ${path}`);
          
          // 1. Upload to Firebase Storage
          const storageRef = ref(storage, path);
          const uploadTask = await uploadBytesResumable(storageRef, file);
          const permanentUrl = await getDownloadURL(uploadTask.ref);

          // 2. Auto-Link: Find any product that saved this local blob URL and update it
          const prodSnap = await getDocs(collection(db, 'products'));
          prodSnap.forEach(async (docSnap) => {
              const data = docSnap.data();
              
              // Check main images
              if (data.images && data.images.includes(localUrl)) {
                  const cleanImages = data.images.map(url => url === localUrl ? permanentUrl : url);
                  await updateDoc(doc(db, 'products', docSnap.id), { images: cleanImages });
              }
              
              // Check variant images
              if (data.variants) {
                  let changed = false;
                  const updatedVariants = data.variants.map(v => {
                      if (v.image === localUrl) {
                          changed = true;
                          return { ...v, image: permanentUrl };
                      }
                      return v;
                  });
                  if (changed) {
                      await updateDoc(doc(db, 'products', docSnap.id), { variants: updatedVariants });
                  }
              }
          });

          // 3. Remove from local queue
          await localforage.removeItem(key);
        }
        
        console.log("Offline queue processed and auto-linked successfully!");
        fetchData(); // Refresh UI to show permanent URLs
      } catch (error) {
        console.error("Error processing offline queue:", error);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
  // ------------------------------------

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) {
        setHideOutOfStock(snap.data().hideOutOfStock || false);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const toggleHideOutOfStock = async () => {
    const newValue = !hideOutOfStock;
    setHideOutOfStock(newValue); 
    try {
      await setDoc(doc(db, 'settings', 'general'), { hideOutOfStock: newValue }, { merge: true });
    } catch (error) {
      console.error("Error updating settings:", error);
      alert("Failed to save settings to database.");
      setHideOutOfStock(!newValue); 
    }
  };

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

  const openDrawer = (type, item = null) => {
    setDrawerType(type);
    if (type === 'product') {
      setSelectedItem(item || { 
        name: '', retail: 0, ws: 0, bulk: 0, retailMoq: 1, wsMoq: 1, bulkMoq: 1, 
        packSize: 1, cartonSize: '', stock: 100, category: '', tagsInput: '', desc: '', images: [], variantLabel: '', variants: [] 
      });
    } else if (type === 'customer') {
      setSelectedItem(item || { name: '', email: '', phone: '', tier: 'wholesale', status: 'pre_approved' });
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

  const handleDelete = async (collectionName, id) => {
    let itemName = collectionName === 'products' ? 'product' : collectionName === 'customers' ? 'customer' : 'order';
    if (!window.confirm(`Are you absolutely sure you want to delete this ${itemName}? This cannot be undone.`)) return;
    
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

  const handleSaveCustomer = async (e) => {
    e.preventDefault();

    if (!selectedItem.email && !selectedItem.phone) {
      alert("Please provide either an Email Address or a Phone Number.");
      return;
    }

    setIsProcessing(true);
    try {
      const safeEmail = selectedItem.email ? selectedItem.email.trim().toLowerCase() : '';
      const safePhone = selectedItem.phone ? selectedItem.phone.trim() : '';

      if (selectedItem.id) {
        await updateDoc(doc(db, 'customers', selectedItem.id), {
          name: selectedItem.name,
          email: safeEmail,
          phone: safePhone,
          tier: selectedItem.tier,
          status: selectedItem.status || 'active'
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          name: selectedItem.name,
          email: safeEmail,
          phone: safePhone,
          tier: selectedItem.tier,
          status: selectedItem.status || 'pre_approved',
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

  const handleApproveAndEmail = async (customer) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'customers', customer.id), { 
        status: 'active', 
        tier: 'wholesale' 
      });
      
      if (customer.email) {
        const subject = encodeURIComponent("Your Garv Gift Gallery Account is Approved!");
        const body = encodeURIComponent(`Hi ${customer.name || 'Valued Customer'},\n\nGreat news! Your account at Garv Gift Gallery has been approved.\n\nYou have been upgraded to our Wholesale tier. You can now log in to view our premium catalogue and access your exclusive pricing.\n\nThank you,\nGarv Gift Gallery`);
        window.location.href = `mailto:${customer.email}?subject=${subject}&body=${body}`;
      } else {
        alert(`Account for ${customer.name || customer.phone} has been Approved! (No email on file to notify them).`);
      }
      
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Error approving customer.");
    } finally {
      setIsProcessing(false);
    }
  };

 const handleSaveProduct = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const validVariants = (selectedItem.variants || []).filter(v => v.name && v.name.trim() !== '');
      const tagsArray = selectedItem.tagsInput ? selectedItem.tagsInput.split(',').map(t => DOMPurify.sanitize(t.trim())).filter(t => t) : (selectedItem.tags || []);
      
      const productData = {
        name: DOMPurify.sanitize(selectedItem.name || ''),
        desc: DOMPurify.sanitize(selectedItem.desc || ''),
        category: DOMPurify.sanitize(selectedItem.category || selectedItem.cat || ''),
        tags: tagsArray,
        stock: Number(selectedItem.stock) || 0,
        retail: Number(selectedItem.retail) || 0,
        ws: Number(selectedItem.ws) || 0,
        bulk: Number(selectedItem.bulk) || 0,
        retailMoq: Number(selectedItem.retailMoq) || 1,
        wsMoq: Number(selectedItem.wsMoq) || 1,
        bulkMoq: Number(selectedItem.bulkMoq) || 1,
        packSize: Number(selectedItem.packSize) || 1,
        cartonSize: selectedItem.cartonSize ? Number(selectedItem.cartonSize) : null,
        images: selectedItem.images || [],
        variantLabel: validVariants.length > 0 ? DOMPurify.sanitize(selectedItem.variantLabel || 'Option') : '',
        variants: validVariants.map(v => ({
          name: DOMPurify.sanitize(v.name.trim()),
          retail: v.retail ? Number(v.retail) : null,
          ws: v.ws ? Number(v.ws) : null,
          bulk: v.bulk ? Number(v.bulk) : null,
          image: v.image || null
        })),
        updatedAt: serverTimestamp()
      };

      // ✨ THE FIX: Network-Aware Database Writes
      if (selectedItem.id) {
        const docRef = doc(db, 'products', selectedItem.id);
        if (navigator.onLine) {
           await updateDoc(docRef, productData); // Wait for server if online
        } else {
           updateDoc(docRef, productData); // Fire & Forget into local cache if offline
        }
      } else {
        const colRef = collection(db, 'products');
        if (navigator.onLine) {
           await addDoc(colRef, { ...productData, createdAt: serverTimestamp() });
        } else {
           addDoc(colRef, { ...productData, createdAt: serverTimestamp() }); 
        }
      }
      
      // ✨ THE FIX: Network-Aware UI Refresh
      if (navigator.onLine) {
          await fetchData();
      } else {
          fetchData(); // Don't freeze the UI waiting for offline cache reads
      }

      closeDrawer();
    } catch (err) {
      alert('Error saving product');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToWebP = async (originalFile) => {
    let fileToProcess = originalFile;
    const isHeic = originalFile.type === "image/heic" || originalFile.type === "image/heif" || originalFile.name.toLowerCase().endsWith(".heic");
    if (isHeic) {
      try {
        const convertedBlob = await heic2any({ blob: originalFile, toType: "image/jpeg", quality: 0.9 });
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        fileToProcess = new File([finalBlob], originalFile.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
      } catch (error) {
        throw new Error("Failed to process HEIC file. Please try a different image.");
      }
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileToProcess);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], originalFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" }));
            } else {
              reject(new Error("Canvas conversion failed"));
            }
          }, 'image/webp', 0.85); 
        };
        img.onerror = () => reject(new Error("Failed to load image onto canvas"));
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // ✨ MODIFIED: Network detection and LocalForage cache integrated
  const handleImageUpload = async (files) => {
    if (!files || !files.length) return;
    setIsProcessing(true);
    try {
      const newImageUrls = [];
      for (const originalFile of files) {
        const webpFile = await convertToWebP(originalFile);
        
        if (!navigator.onLine) {
          // OFFLINE MODE: Save to localforage and generate temporary URL
          const localUrl = URL.createObjectURL(webpFile);
          const fileKey = `offline_img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          
          await localforage.setItem(fileKey, {
            file: webpFile,
            localUrl: localUrl,
            path: `product-images/offline-${Date.now()}-${webpFile.name}`
          });
          
          newImageUrls.push(localUrl);
        } else {
          // ONLINE MODE: Direct upload to Firebase Storage
          const storageRef = ref(storage, `product-images/${Date.now()}-${webpFile.name}`);
          const uploadTask = await uploadBytesResumable(storageRef, webpFile);
          newImageUrls.push(await getDownloadURL(uploadTask.ref));
        }
      }
      setSelectedItem(prev => ({ 
        ...prev, 
        images: [...(prev.images || []), ...newImageUrls] 
      }));
    } catch (error) {
      alert(error.message || 'Upload failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleImageUpload,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif']
    },
    disabled: isProcessing
  });

  // ✨ MODIFIED: Network detection and LocalForage cache for Variants
  const handleVariantImageUpload = async (index, event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const webpFile = await convertToWebP(file);
      let finalUrl = '';

      if (!navigator.onLine) {
        // OFFLINE MODE
        finalUrl = URL.createObjectURL(webpFile);
        const fileKey = `offline_img_var_${Date.now()}`;
        await localforage.setItem(fileKey, {
          file: webpFile,
          localUrl: finalUrl,
          path: `product-images/offline-var-${Date.now()}-${webpFile.name}`
        });
      } else {
        // ONLINE MODE
        const storageRef = ref(storage, `product-images/${Date.now()}-var-${webpFile.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, webpFile);
        finalUrl = await getDownloadURL(uploadTask.ref);
      }

      const newVariants = [...(selectedItem.variants || [])];
      newVariants[index].image = finalUrl; 
      setSelectedItem(prev => ({ ...prev, variants: newVariants }));
    } catch (error) {
      alert('Variant image upload failed.');
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

  const handleAddVariant = () => {
    setSelectedItem(prev => ({ 
      ...prev, 
      variants: [...(prev.variants || []), { name: '', retail: '', ws: '', bulk: '', image: '' }] 
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

  const handleBulkImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let count = 0;
          
          const chunks = [];
          for (let i = 0; i < results.data.length; i += 400) {
            chunks.push(results.data.slice(i, i + 400));
          }

          for (const chunk of chunks) {
            const batch = writeBatch(db);
            
            chunk.forEach((row) => {
              const rowName = row.Name || row.name || row.Title || row.title;
              if (!rowName) return; 

              const safeTitle = DOMPurify.sanitize(rowName);
              const existingProduct = products.find(p => (p.name || p.title || "").toLowerCase() === safeTitle.toLowerCase());
              const docRef = existingProduct ? doc(db, 'products', existingProduct.id) : doc(collection(db, 'products')); 
              
              const rawImages = row.Images || row.images || row.imageUrl || row.image;
              const imageArray = rawImages ? String(rawImages).split(',').map(i => DOMPurify.sanitize(i.trim())).filter(i => i) : [];
              
              const rawTags = row.Tags || row.tags;
              const tagsArray = rawTags ? String(rawTags).split(',').map(t => DOMPurify.sanitize(t.trim())).filter(t => t) : [];
              
              const rawCarton = row.Carton_Size || row.cartonSize || row.carton;

              batch.set(docRef, {
                name: safeTitle,
                retail: Number(row.Retail_Price || row.retail) || 0,
                ws: Number(row.WS_Price || row.ws || row.wholesalePrice) || 0,
                bulk: Number(row.Bulk_Price || row.bulk || row.bulkPrice) || 0,
                retailMoq: Number(row.Retail_MOQ || row.retailMoq || row.moq) || 1,
                wsMoq: Number(row.WS_MOQ || row.wsMoq || row.moq) || 1,
                bulkMoq: Number(row.Bulk_MOQ || row.bulkMoq || row.moq) || 1,
                packSize: Number(row.Pack_Size || row.packSize) || 1,
                cartonSize: rawCarton ? Number(rawCarton) : null,
                stock: Number(row.Stock || row.stock) || 0, 
                desc: DOMPurify.sanitize(row.Description || row.desc || row.description || ""),
                category: DOMPurify.sanitize(row.Category || row.category || row.cat || ""), 
                tags: tagsArray, 
                images: imageArray, 
              }, { merge: true }); 
              count++;
            });

            await batch.commit(); 
          }

          alert(`✅ Successfully processed ${count} products!`);
          fetchData();
        } catch (error) {
          console.error("Bulk Import Error:", error);
          alert(`❌ Failed to process CSV: ${error.message}`);
        } finally {
          setIsProcessing(false);
          event.target.value = null; 
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
      Retail_MOQ: p.retailMoq, WS_MOQ: p.wsMoq, Bulk_MOQ: p.bulkMoq, 
      Pack_Size: p.packSize,
      Carton_Size: p.cartonSize || '', 
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

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || 
             (p.category || p.cat || '').toLowerCase().includes(q) ||
             (p.tags || []).some(t => t.toLowerCase().includes(q));
    }).sort((a, b) => {
      if (sortBy === 'priceAsc') return a.retail - b.retail;
      if (sortBy === 'priceDesc') return b.retail - a.retail;
      if (sortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
      return 0; 
    });
  }, [products, searchQuery, sortBy]);

  const filteredActiveCustomers = useMemo(() => {
    return customers
      .filter(c => c.status !== 'pending')
      .filter(c => {
         const q = customerSearchQuery.toLowerCase();
         return (c.name || '').toLowerCase().includes(q) || 
                (c.email || '').toLowerCase().includes(q) ||
                (c.phone || '').includes(q);
      })
      .sort((a, b) => {
         if (customerSortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
         if (customerSortBy === 'tier') return (a.tier || '').localeCompare(b.tier || '');
         return (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
      });
  }, [customers, customerSearchQuery, customerSortBy]);


  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative bg-[#F9F8F6] min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-6 mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight uppercase">Control Center</h2>
          <p className="text-gray-500 text-sm mt-1">Manage inventory, orders, and CRM securely.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm" title="When ON, standard users will not see items with 0 stock.">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hide Out-of-Stock for Users</span>
            <button 
              onClick={toggleHideOutOfStock} 
              className={`w-11 h-6 rounded-full p-1 flex items-center transition-colors duration-300 ease-in-out ${hideOutOfStock ? 'bg-[#D4AF37]' : 'bg-gray-300'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${hideOutOfStock ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
          </div>
          
          <button onClick={handleLogout} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-semibold hover:bg-gray-50 transition">
            Sign Out
          </button>
        </div>
      </div>

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
                      <p className="text-sm text-gray-500">{cust.email || 'No Email'}</p>
                      <p className="text-xs text-gray-400 mt-1">{cust.phone || 'No Phone'}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedItem({...cust, status: 'active', tier: 'wholesale'});
                          openDrawer('customer', {...cust, status: 'active', tier: 'wholesale'});
                        }} 
                        className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-bold py-2 rounded hover:bg-gray-50 transition uppercase shadow-sm"
                      >
                        Review
                      </button>
                      <button 
                        onClick={() => handleApproveAndEmail(cust)} 
                        disabled={isProcessing} 
                        className="flex-1 bg-[#111111] text-white text-xs font-bold py-2 rounded hover:bg-black transition uppercase disabled:opacity-50 shadow-sm"
                      >
                        Approve
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE ROSTER */}
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h3 className="text-gray-900 font-bold uppercase tracking-wider m-0">Active Roster</h3>
              
              <div className="flex w-full md:w-auto gap-2">
                <input 
                  type="text" 
                  placeholder="Search customers..." 
                  value={customerSearchQuery} 
                  onChange={(e) => setCustomerSearchQuery(e.target.value)} 
                  className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm" 
                />
                <select 
                  value={customerSortBy} 
                  onChange={(e) => setCustomerSortBy(e.target.value)} 
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm bg-white cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="nameAsc">A - Z</option>
                  <option value="tier">Tier</option>
                </select>
                <button 
                  onClick={() => setCustomerViewMode(customerViewMode === 'grid' ? 'list' : 'grid')} 
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-200 hidden md:block transition-colors"
                >
                  {customerViewMode === 'grid' ? '☰ List' : '⊞ Grid'}
                </button>
              </div>
            </div>

            <div className={customerViewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-2"}>
              {filteredActiveCustomers.map((cust) => (
                <div 
                  key={cust.id} 
                  onClick={() => openDrawer('customer', cust)} 
                  className={`bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:border-[#D4AF37] transition relative overflow-hidden ${customerViewMode === 'grid' ? 'p-5 flex flex-col justify-between h-full' : 'p-3 flex flex-row items-center justify-between'}`}
                >
                  {cust.status === 'pre_approved' && (
                    <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[9px] font-bold px-2 py-1 uppercase rounded-bl-lg">
                      Pre-Approved
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-gray-900">{cust.name || 'Valued Customer'}</h4>
                    <p className="text-sm text-gray-500">{cust.email || 'No Email'}</p>
                    {customerViewMode === 'grid' && (
                      <p className="text-xs text-gray-400 mt-1">{cust.phone || 'No Phone'}</p>
                    )}
                  </div>
                  <div className={customerViewMode === 'grid' ? 'mt-4' : ''}>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      cust.tier === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : 
                      ['wholesale', 'management', 'staff'].includes(cust.tier) ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      cust.tier === 'bulk' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {cust.tier || 'Retail'}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredActiveCustomers.length === 0 && (
                 <p className="text-gray-500 text-sm mt-4">No matching customers found.</p>
              )}
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
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex flex-wrap gap-3 mb-3">
                      {selectedItem?.images?.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-300 shadow-sm">
                          <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => handleRemoveImage(idx)} 
                            className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:text-red-500 text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div 
                      {...getRootProps()} 
                      className={`w-full py-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors duration-200
                        ${isDragActive ? 'border-[#D4AF37] bg-[#F9F8F6]' : 'border-gray-300 bg-white hover:bg-gray-50'}
                        ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <input {...getInputProps()} disabled={isProcessing} />
                      {isProcessing ? (
                        <span className="text-sm font-semibold text-gray-500 text-center">
                          Uploading & Optimizing...<br/>
                          <span className="text-xs font-normal text-gray-400">Please wait</span>
                        </span>
                      ) : isDragActive ? (
                        <span className="text-sm font-bold text-[#D4AF37]">Drop the photos here...</span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-500 text-center">
                          + Drag & Drop Photos Here<br/>
                          <span className="text-xs font-normal text-gray-400">or click to browse (HEIC/JPG/PNG)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Product Title</label>
                    <input 
                      required 
                      type="text" 
                      value={selectedItem?.name} 
                      onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Base Retail</label>
                      <input 
                        required 
                        type="number" 
                        value={selectedItem?.retail} 
                        onChange={e => setSelectedItem({...selectedItem, retail: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Base WS</label>
                      <input 
                        required 
                        type="number" 
                        value={selectedItem?.ws} 
                        onChange={e => setSelectedItem({...selectedItem, ws: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Base Bulk</label>
                      <input 
                        required 
                        type="number" 
                        value={selectedItem?.bulk} 
                        onChange={e => setSelectedItem({...selectedItem, bulk: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ret MOQ</label>
                      <input 
                        required 
                        type="number" 
                        min="1" 
                        value={selectedItem?.retailMoq} 
                        onChange={e => setSelectedItem({...selectedItem, retailMoq: e.target.value})} 
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">WS MOQ</label>
                      <input 
                        required 
                        type="number" 
                        min="1" 
                        value={selectedItem?.wsMoq} 
                        onChange={e => setSelectedItem({...selectedItem, wsMoq: e.target.value})} 
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bulk MOQ</label>
                      <input 
                        required 
                        type="number" 
                        min="1" 
                        value={selectedItem?.bulkMoq} 
                        onChange={e => setSelectedItem({...selectedItem, bulkMoq: e.target.value})} 
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Main Category (Pill)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Lamps" 
                        value={selectedItem?.category || selectedItem?.cat || ''} 
                        onChange={e => setSelectedItem({...selectedItem, category: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Stock Qty</label>
                      <input 
                        required 
                        type="number" 
                        min="0" 
                        value={selectedItem?.stock} 
                        onChange={e => setSelectedItem({...selectedItem, stock: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tags (Comma Separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. brass, gift" 
                      value={selectedItem?.tagsInput || (selectedItem?.tags ? selectedItem.tags.join(', ') : '')} 
                      onChange={e => setSelectedItem({...selectedItem, tagsInput: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pack Size</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={selectedItem?.packSize} 
                        onChange={e => setSelectedItem({...selectedItem, packSize: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Master Carton Size</label>
                      <input 
                        type="number" 
                        min="1" 
                        placeholder="Optional" 
                        value={selectedItem?.cartonSize || ''} 
                        onChange={e => setSelectedItem({...selectedItem, cartonSize: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold text-gray-700 uppercase">Variants (Optional)</label>
                      <button 
                        type="button" 
                        onClick={handleAddVariant} 
                        className="text-[10px] bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-100 font-bold uppercase tracking-wider shadow-sm"
                      >
                        + Add Option
                      </button>
                    </div>

                    {selectedItem?.variants?.length > 0 ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Variant Category Label</label>
                          <input 
                            type="text" 
                            placeholder="e.g., Finish" 
                            value={selectedItem?.variantLabel || ''} 
                            onChange={e => setSelectedItem({...selectedItem, variantLabel: e.target.value})} 
                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" 
                          />
                        </div>
                        
                        <div className="space-y-3">
                          {selectedItem.variants.map((variant, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-md shadow-sm">
                              
                              <div className="flex gap-2 items-center">
                                <label className="relative w-10 h-10 bg-gray-100 border border-dashed border-gray-400 rounded overflow-hidden flex-shrink-0 cursor-pointer hover:border-[#D4AF37] flex items-center justify-center transition-colors">
                                  {variant.image ? (
                                    <img src={variant.image} alt="Var" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-gray-400 text-[9px] text-center leading-none font-bold uppercase tracking-wider">+<br/>Img</span>
                                  )}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleVariantImageUpload(idx, e)} disabled={isProcessing} />
                                </label>

                                <input 
                                  type="text" 
                                  placeholder={`Option ${idx + 1}`} 
                                  value={variant.name} 
                                  onChange={e => handleVariantChange(idx, 'name', e.target.value)} 
                                  className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" 
                                  required 
                                />
                                
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveVariant(idx)} 
                                  className="text-red-400 hover:text-red-600 font-bold px-2 text-lg leading-none"
                                >
                                  &times;
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    ) : <p className="text-[11px] text-gray-500 italic mt-2">No variants.</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                    <textarea 
                      rows="3" 
                      value={selectedItem?.desc} 
                      onChange={e => setSelectedItem({...selectedItem, desc: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                    ></textarea>
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
                      <p className="text-sm text-blue-800 font-medium">Pre-approve a client. Ensure you add EITHER their phone or email below.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address <span className="text-gray-400 font-normal lowercase">(Optional if phone is provided)</span></label>
                    <input 
                      type="email" 
                      disabled={!!selectedItem?.id && !!selectedItem?.email} 
                      value={selectedItem?.email || ''} 
                      onChange={e => setSelectedItem({...selectedItem, email: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none disabled:bg-gray-100" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                    <input 
                      required 
                      type="text" 
                      value={selectedItem?.name || ''} 
                      onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number <span className="text-gray-400 font-normal lowercase">(Optional if email is provided)</span></label>
                    <input 
                      type="text" 
                      value={selectedItem?.phone || ''} 
                      onChange={e => setSelectedItem({...selectedItem, phone: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tier</label>
                      <select 
                        value={selectedItem?.tier || 'retail'} 
                        onChange={e => setSelectedItem({...selectedItem, tier: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none cursor-pointer"
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="bulk">Bulk</option>
                        <option disabled>──────────</option>
                        <option value="staff">Staff (Internal)</option>
                        <option value="management">Management (Internal)</option>
                        <option value="admin">Admin (Internal)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Status</label>
                      <select 
                        value={selectedItem?.status || 'pre_approved'} 
                        onChange={e => setSelectedItem({...selectedItem, status: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none cursor-pointer"
                      >
                        <option value="active">Active</option>
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
                type="submit" 
                form="drawerForm" 
                disabled={isProcessing} 
                className="w-full bg-[#111111] text-white py-3.5 rounded-md font-bold hover:bg-black transition shadow-md disabled:opacity-50 uppercase tracking-wide"
              >
                {isProcessing ? 'Saving...' : `Save ${drawerType}`}
              </button>
              
              {selectedItem?.id && (
                <button 
                  type="button" 
                  onClick={() => handleDelete(drawerType === 'product' ? 'products' : 'customers', selectedItem.id)} 
                  disabled={isProcessing} 
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