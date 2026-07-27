import React from 'react';
import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import heic2any from 'heic2any';

const TriageQueue = ({ pendingImages, setPendingImages, setIsProcessing, onImageSelected, selectedImage }) => {

  const convertToWebP = async (originalFile) => {
    let fileToProcess = originalFile;
    const isHeic = originalFile.type === "image/heic" || originalFile.type === "image/heif" || originalFile.name.toLowerCase().endsWith(".heic");
    if (isHeic) {
      try {
        const convertedBlob = await heic2any({ blob: originalFile, toType: "image/jpeg", quality: 0.9 });
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        fileToProcess = new File([finalBlob], originalFile.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
      } catch (error) {
        throw new Error("Failed to process HEIC file.");
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

  const onDrop = async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    setIsProcessing(true);
    const newImages = [];
    try {
      for (const file of acceptedFiles) {
        const webpFile = await convertToWebP(file);
        const storageRef = ref(storage, `staging/${Date.now()}_${webpFile.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, webpFile);
        const url = await getDownloadURL(uploadTask.ref);
        newImages.push({ id: uploadTask.ref.fullPath, url, name: webpFile.name });
      }
      setPendingImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error(err);
      alert(err.message || "Upload pipeline encountered an error.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ✨ NEW: Discard redundant images manually from queue
  const handleDiscardImage = (idToRemove, e) => {
    e.stopPropagation(); // Prevents opening the left preview panel
    setPendingImages(prev => prev.filter(img => img.id !== idToRemove));
    if (selectedImage?.id === idToRemove) {
      onImageSelected(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'image/*': [], '.heic': [], '.heif': []} });

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div {...getRootProps()} className={`border-2 border-dashed p-6 text-center cursor-pointer mb-4 rounded-lg transition-colors ${isDragActive ? 'border-[#D4AF37] bg-yellow-50/50' : 'border-gray-300 hover:border-[#D4AF37]'}`}>
        <input {...getInputProps()} />
        <p className="text-sm font-bold uppercase text-gray-600">
          {isDragActive ? "Drop to Stage Images!" : "+ Drag & Drop Batch Here"}
        </p>
      </div>
      
      <div className="grid grid-cols-5 gap-3 max-h-48 overflow-y-auto p-1 hide-scrollbar">
        {pendingImages.map(item => (
          <div key={item.id} className="relative group">
            <img 
              src={item.url} 
              onClick={() => onImageSelected(item)}
              className={`w-full h-16 object-cover rounded cursor-pointer border-2 transition-all ${selectedImage?.id === item.id ? 'border-[#D4AF37] scale-95 ring-2 ring-yellow-100' : 'border-transparent hover:border-gray-400'}`} 
            />
            {/* ✨ RED DISCARD BUTTON: Click to remove redundant photo from queue */}
            <button
              type="button"
              onClick={(e) => handleDiscardImage(item.id, e)}
              title="Remove duplicate/redundant image from queue"
              className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-black shadow-md hover:bg-red-700 transition opacity-80 group-hover:opacity-100 z-20"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TriageQueue;