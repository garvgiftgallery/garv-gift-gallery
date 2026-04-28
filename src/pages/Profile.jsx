import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Make sure this path points to your firebase config

const Profile = () => {
  const { currentUser, userTier, logout } = useAuth();
  const navigate = useNavigate();

  // State for editing name
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentUser?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleSaveName = async () => {
    setError('');
    
    // Security Layer 1: Sanitize (trim whitespace)
    const sanitizedName = newName.trim();
    
    // Security Layer 2: Validation & Payload Limiting
    if (sanitizedName.length === 0) {
      setError('Name cannot be empty.');
      return;
    }
    if (sanitizedName.length > 50) {
      setError('Name is too long (max 50 characters).');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update the Firebase Auth Token identity
      await updateProfile(currentUser, { displayName: sanitizedName });
      
      // 2. Update the permanent Firestore Database record
      const userRef = doc(db, 'customers', currentUser.uid);
      await updateDoc(userRef, { name: sanitizedName });
      
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError('Failed to update name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const initial = currentUser?.displayName 
    ? currentUser.displayName.charAt(0).toUpperCase() 
    : (currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'V');

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      {/* 💳 PROFILE CARD */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 relative">
        
        <button 
          onClick={handleLogout}
          className="absolute top-6 right-6 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Sign Out
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-4">
          <div className="w-20 h-20 bg-black text-[#D4AF37] rounded-full flex items-center justify-center text-3xl font-bold">
            {initial}
          </div>
          
          <div className="w-full max-w-sm flex flex-col items-center">
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            
            {/* NAME DISPLAY & EDITING UI */}
            {isEditing ? (
              <div className="flex flex-col w-full space-y-2 mt-2">
                <input 
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={50} // Enforces limit natively in HTML
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] focus:outline-none text-center"
                  placeholder="Enter your name"
                />
                <div className="flex justify-center gap-2">
                  <button 
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="bg-[#111111] text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setNewName(currentUser?.displayName || '');
                      setError('');
                    }}
                    disabled={isSaving}
                    className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {currentUser?.displayName || 'Valued Customer'}
                </h1>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-[#D4AF37] transition-colors mt-1"
                  title="Edit Name"
                >
                  {/* Simple Pencil Icon */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}

            <p className="text-gray-500 mt-2">{currentUser?.email || currentUser?.phoneNumber}</p>
            
            {/* Show Pricing Tier */}
            <div className="mt-3 inline-block bg-[#F9F8F6] border border-[#D4AF37] text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Tier: {userTier}
            </div>
          </div>
        </div>

        {/* 🚨 THE VIP DOOR: Only shows if user is an Admin */}
        {userTier === 'admin' && (
          <div className="mt-8 border-t border-gray-100 pt-6 flex justify-center">
            <Link 
              to="/garv-secure-admin" 
              className="bg-[#D4AF37] text-white px-8 py-3 rounded-md font-bold uppercase tracking-wider hover:bg-[#b5952f] transition-colors shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Open Admin Dashboard
            </Link>
          </div>
        )}
      </div>

      {/* 📦 ORDER HISTORY */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Order History</h2>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
          No past orders found.
        </div>
      </div>
    </div>
  );
};

export default Profile;
