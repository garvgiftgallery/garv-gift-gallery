import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
// Make sure this path points to your actual firebase configuration file
import { storage } from '../../firebaseConfig'; 

const DragDropUploader = ({ currentCategory, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    // We only process the first file since this is for one-off additions
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);
    const file = acceptedFiles[0]; 
    
    // Create a reference to the staging_images bucket
    const storageRef = ref(storage, `staging_images/${currentCategory}/${file.name}`);
    
    // Upload the file and inject the critical category metadata
    const uploadTask = uploadBytesResumable(storageRef, file, {
      customMetadata: { category: currentCategory }
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const currentProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(currentProgress);
      },
      (error) => {
        console.error("Upload failed:", error);
        setUploading(false);
      },
      async () => {
        // Upload complete! Get the URL
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setUploading(false);
        setProgress(0);
        
        // Pass the data back up to your parent component (the smart filter UI)
        onUploadSuccess({ 
            url: downloadURL, 
            name: file.name, 
            category: currentCategory 
        });
      }
    );
  }, [currentCategory, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    multiple: false // Strictly limits to one image at a time
  });

  return (
    <div 
      {...getRootProps()} 
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200
        ${isDragActive ? 'border-gray-800 bg-gray-100' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
      `}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="text-gray-800 font-medium text-sm tracking-wide">
          Uploading... {Math.round(progress)}%
        </div>
      ) : isDragActive ? (
        <p className="text-gray-800 font-semibold text-sm tracking-wide">Drop the image here...</p>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-2">
            <p className="text-gray-700 text-sm font-medium">
            Drag & drop an image, or click to browse
            </p>
            <span className="text-xs font-normal text-gray-500 uppercase tracking-widest">
            Category: {currentCategory || 'Select a category first'}
            </span>
        </div>
      )}
    </div>
  );
};

export default DragDropUploader;