import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import TriageQueue from '../components/admin/TriageQueue';
import ProductEditDrawer from '../components/admin/ProductEditDrawer';

const TriageDashboard = () => {
  const [pendingImages, setPendingImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      (p.name || '').toLowerCase().includes(q) || 
      (p.category || p.cat || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const handleMatchTarget = (product) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex h-screen w-full bg-[#F9F8F6] fixed inset-0 overflow-hidden">
      {/* LEFT PANEL: Visual Reference Inspector */}
      <div className="w-1/2 p-8 flex flex-col items-center justify-center bg-gray-100/50 border-r border-gray-200 h-full relative">
        {selectedImage ? (
          <div className="flex flex-col items-center gap-3">
            <img src={selectedImage.url} className="max-h-[75vh] object-contain rounded-xl shadow-2xl border bg-white" alt="Reference" />
            <span className="text-xs font-mono text-gray-500 bg-gray-200 px-3 py-1 rounded-full">{selectedImage.name}</span>
          </div>
        ) : (
          <div className="text-gray-400 text-sm font-semibold border-2 border-dashed border-gray-300 p-12 rounded-xl bg-white/50 text-center">
            Select or upload staged images to start triaging
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Queue, Search & Rich Result Cards */}
      <div className="w-1/2 p-8 overflow-y-auto h-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900">Triage Pipeline</h1>
          <p className="text-xs text-gray-500 mt-1">Inspect raw image data, search products, and map photos directly to database items.</p>
        </div>

        <TriageQueue 
          pendingImages={pendingImages} 
          setPendingImages={setPendingImages} 
          setIsProcessing={setIsProcessing}
          onImageSelected={setSelectedImage}
          selectedImage={selectedImage}
        />
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Product Index Search</label>
          <input 
            type="text" 
            placeholder="Search by title, category, or tag (e.g., Brass, Lamp)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-sm bg-white" 
          />
        </div>

        {/* SEARCH RESULT CARDS */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 hide-scrollbar">
          {filteredSearchResults.map(prod => (
            <div 
              key={prod.id} 
              onClick={() => handleMatchTarget(prod)} 
              className="p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#D4AF37] hover:shadow-md transition flex flex-col gap-2.5 group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-gray-900 group-hover:text-[#D4AF37] transition text-base">{prod.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] bg-[#F9F8F6] border border-[#D4AF37] px-2 py-0.5 rounded text-[#D4AF37] font-bold uppercase tracking-wider">
                      {prod.category || prod.cat || 'UNTAGGED'}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">Stock: {prod.stock ?? 0}</span>
                    {prod.cartonSize && <span className="text-xs text-gray-500 font-medium">| Carton: {prod.cartonSize} pcs</span>}
                  </div>
                </div>
                <button className="text-xs bg-[#111111] text-white px-4 py-2 rounded-md font-bold uppercase tracking-wider group-hover:bg-[#D4AF37] transition shrink-0">
                  Match & Edit
                </button>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-lg text-xs font-semibold text-gray-700 border border-gray-100">
                <div><span className="text-gray-400 font-normal">Ret:</span> ₹{prod.retail || 0} <span className="text-[10px] text-gray-400">(MOQ: {prod.retailMoq || 1})</span></div>
                <div><span className="text-gray-400 font-normal">WS:</span> ₹{prod.ws || 0} <span className="text-[10px] text-gray-400">(MOQ: {prod.wsMoq || 1})</span></div>
                <div><span className="text-gray-400 font-normal">Bulk:</span> ₹{prod.bulk || 0} <span className="text-[10px] text-gray-400">(MOQ: {prod.bulkMoq || 1})</span></div>
              </div>

              {/* Tags Display */}
              {prod.tags && prod.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Tags:</span>
                  {prod.tags.map((t, i) => (
                    <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {searchQuery && filteredSearchResults.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-6">No matching records found in catalog cache.</p>
          )}
        </div>
      </div>

      {isDrawerOpen && (
        <ProductEditDrawer 
          item={selectedProduct} 
          activeImage={selectedImage} 
          onClose={() => setIsDrawerOpen(false)} 
          onSaveSuccess={() => {
            if (selectedImage) {
              // ✨ HANDS-FREE AUTO-ADVANCE: Remove saved image and auto-select the next image in queue
              setPendingImages(prev => {
                const currentIndex = prev.findIndex(img => img.id === selectedImage.id);
                const nextQueue = prev.filter(img => img.id !== selectedImage.id);
                
                if (nextQueue.length > 0) {
                  const nextIndex = currentIndex < nextQueue.length ? currentIndex : nextQueue.length - 1;
                  setSelectedImage(nextQueue[nextIndex]);
                } else {
                  setSelectedImage(null);
                }
                
                return nextQueue;
              });
            }
            fetchProducts();
          }}
        />
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm text-gray-800">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-[#D4AF37]" />
            Processing Assets...
          </div>
        </div>
      )}
    </div>
  );
};

export default TriageDashboard;