import React, { useState, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import DOMPurify from 'dompurify';

const QUICK_TAGS = ["Brass", "Gift", "Corporate", "Home Decor", "Premium", "Diwali", "Lamp", "Handicraft"];

const ProductEditDrawer = ({ item, activeImage, onClose, onSaveSuccess }) => {
  const [formData, setFormData] = useState({
    name: '', retail: 0, ws: 0, bulk: 0, 
    retailMoq: 1, wsMoq: 1, bulkMoq: 1, 
    packSize: 1, cartonSize: '', stock: 100, 
    category: '', tagsInput: '', desc: '', images: [], 
    variantLabel: '', variants: []
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
        tagsInput: item.tagsInput || (item.tags ? item.tags.join(', ') : '')
      });
    }
  }, [item]);

  const addQuickTag = (tag) => {
    setFormData(prev => {
      const current = prev.tagsInput || '';
      if (current.toLowerCase().includes(tag.toLowerCase())) return prev;
      return { ...prev, tagsInput: current ? `${current}, ${tag}` : tag };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const validVariants = (formData.variants || []).filter(v => v.name && v.name.trim() !== '');
      const tagsArray = formData.tagsInput 
        ? formData.tagsInput.split(',').map(t => DOMPurify.sanitize(t.trim())).filter(t => t) 
        : (formData.tags || []);

      const finalImages = activeImage 
        ? [...(formData.images || []), activeImage.url]
        : (formData.images || []);

      const payload = {
        name: DOMPurify.sanitize(formData.name || ''),
        desc: DOMPurify.sanitize(formData.desc || ''),
        category: DOMPurify.sanitize(formData.category || formData.cat || ''),
        tags: tagsArray,
        stock: Number(formData.stock) || 0,
        retail: Number(formData.retail) || 0,
        ws: Number(formData.ws) || 0,
        bulk: Number(formData.bulk) || 0,
        retailMoq: Number(formData.retailMoq) || 1,
        wsMoq: Number(formData.wsMoq) || 1,
        bulkMoq: Number(formData.bulkMoq) || 1,
        packSize: Number(formData.packSize) || 1,
        cartonSize: formData.cartonSize ? Number(formData.cartonSize) : null,
        images: finalImages,
        variantLabel: validVariants.length > 0 ? DOMPurify.sanitize(formData.variantLabel || 'Option') : '',
        variants: validVariants.map(v => ({
          name: DOMPurify.sanitize(v.name.trim()),
          retail: v.retail ? Number(v.retail) : null,
          ws: v.ws ? Number(v.ws) : null,
          bulk: v.bulk ? Number(v.bulk) : null,
          image: v.image || null
        })),
        updatedAt: serverTimestamp()
      };

      if (formData.id) {
        await updateDoc(doc(db, 'products', formData.id), payload);
      } else {
        await addDoc(collection(db, 'products'), { ...payload, createdAt: serverTimestamp() });
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error saving product: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none" onKeyDown={handleKeyDown}>
      {/* ✨ NO BLUR: Transparent click-outside overlay so left image stays 100% sharp and readable */}
      <div className="absolute inset-0 bg-black/10 pointer-events-auto transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white h-full p-6 shadow-2xl overflow-y-auto z-50 flex flex-col justify-between pointer-events-auto border-l border-gray-300">
        
        <div className="space-y-5">
          <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">Match & Edit Details</h2>
            <button onClick={onClose} className="text-3xl text-gray-400 hover:text-black leading-none">&times;</button>
          </div>

          {/* ATTACHED IMAGE PREVIEW */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Image Attachments</label>
            <div className="flex flex-wrap gap-2">
              {formData.images?.map((img, idx) => (
                <div key={idx} className="w-16 h-16 rounded border overflow-hidden relative">
                  <img src={img} alt="Product" className="w-full h-full object-cover" />
                </div>
              ))}
              {activeImage && (
                <div className="w-16 h-16 rounded border-2 border-[#D4AF37] overflow-hidden relative shadow-md">
                  <div className="absolute inset-0 bg-[#D4AF37]/20 flex items-center justify-center">
                    <span className="text-[7px] font-black text-black bg-[#D4AF37] px-1 py-0.5 rounded shadow uppercase">NEW</span>
                  </div>
                  <img src={activeImage.url} alt="To Attach" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* TITLE */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Product Title</label>
            <input 
              required
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#D4AF37] focus:outline-none" 
            />
          </div>

          {/* CATEGORY & STOCK */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Category (Pill)</label>
              <input 
                placeholder="e.g. Lamps, Brass"
                value={formData.category || ''} 
                onChange={e => setFormData({...formData, category: e.target.value})} 
                className="w-full p-2.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Stock Qty</label>
              <input 
                type="number"
                min="0"
                value={formData.stock ?? 100} 
                onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
                className="w-full p-2.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" 
              />
            </div>
          </div>

          {/* PRICING GRID */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Retail (₹)</label>
              <input 
                type="number" 
                value={formData.retail || ''} 
                onChange={e => setFormData({...formData, retail: Number(e.target.value)})} 
                className="w-full p-2 border border-gray-300 rounded text-sm font-semibold" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Wholesale (₹)</label>
              <input 
                type="number" 
                value={formData.ws || ''} 
                onChange={e => setFormData({...formData, ws: Number(e.target.value)})} 
                className="w-full p-2 border border-gray-300 rounded text-sm font-semibold" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Bulk (₹)</label>
              <input 
                type="number" 
                value={formData.bulk || ''} 
                onChange={e => setFormData({...formData, bulk: Number(e.target.value)})} 
                className="w-full p-2 border border-gray-300 rounded text-sm font-semibold" 
              />
            </div>
          </div>

          {/* MOQ GRID */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Ret MOQ</label>
              <input 
                type="number" 
                min="1"
                value={formData.retailMoq || 1} 
                onChange={e => setFormData({...formData, retailMoq: Number(e.target.value)})} 
                className="w-full p-2 border border-gray-300 rounded text-xs" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">WS MOQ</label>
              <input 
                type="number" 
                min="1"
                value={formData.wsMoq || 1} 
                onChange={e => setFormData({...formData, wsMoq: Number(e.target.value)})} 
                className="w-full p-2 border border-gray-300 rounded text-xs" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Bulk MOQ</label>
              <input 
                type="number" 
                min="1"
                value={formData.bulkMoq || 1} 
                onChange={e => setFormData({...formData, bulkMoq: Number(e.target.value)})} 
                className="w-full p-2 border border-gray-300 rounded text-xs" 
              />
            </div>
          </div>

          {/* TAGS + QUICK-TAG TAP BUTTONS */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Tags (Comma Separated)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addQuickTag(tag)}
                  className="bg-gray-100 border border-gray-300 text-gray-700 text-[10px] font-bold px-2 py-1 rounded hover:bg-[#D4AF37] hover:text-white transition uppercase tracking-wider"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <input 
              type="text" 
              placeholder="e.g. brass, gift, corporate"
              value={formData.tagsInput || ''} 
              onChange={e => setFormData({...formData, tagsInput: e.target.value})} 
              className="w-full p-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" 
            />
          </div>

          {/* PACK & CARTON SIZE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Pack Size</label>
              <input 
                type="number" 
                min="1"
                value={formData.packSize || 1} 
                onChange={e => setFormData({...formData, packSize: Number(e.target.value)})} 
                className="w-full p-2.5 border border-gray-300 rounded text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Master Carton Size</label>
              <input 
                type="number" 
                min="1"
                placeholder="Optional"
                value={formData.cartonSize || ''} 
                onChange={e => setFormData({...formData, cartonSize: e.target.value})} 
                className="w-full p-2.5 border border-gray-300 rounded text-sm" 
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Description</label>
            <textarea 
              rows="3" 
              value={formData.desc || ''} 
              onChange={e => setFormData({...formData, desc: e.target.value})} 
              className="w-full p-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" 
            />
          </div>
        </div>

        {/* SAVE BUTTON */}
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-[#111111] text-white py-4 font-bold uppercase tracking-widest mt-6 rounded hover:bg-black transition flex justify-center items-center gap-2 shadow-lg"
        >
          {isSaving ? 'Saving...' : 'Save & Remove From Queue'}
          <span className="text-[10px] text-gray-400 bg-[#222] px-2 py-0.5 rounded border border-gray-700 font-normal">Cmd + Enter</span>
        </button>
      </div>
    </div>
  );
};

export default ProductEditDrawer;