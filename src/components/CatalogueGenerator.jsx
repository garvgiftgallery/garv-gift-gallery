import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const CatalogueGenerator = ({ products, isGenerating, onComplete, pricingMode = 'wholesale' }) => {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (isGenerating && products.length > 0) {
      setStatus('Downloading high-res images...');
      
      // ✨ FIXED: Wait 2.5 seconds to guarantee all images are fully loaded by the browser
      // before taking the canvas snapshot.
      setTimeout(() => {
        generatePDF();
      }, 2500);

    } else if (isGenerating) {
      alert("Please select at least one product to generate a catalogue.");
      onComplete();
    }
  }, [isGenerating, products]);

  const generatePDF = async () => {
    setStatus('Stitching PDF Layout...');
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = containerRef.current.children;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { 
          scale: 2, // High resolution
          useCORS: true, // Allows Firebase images
          logging: false,
          backgroundColor: '#FFFFFF'
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        if (i > 0) pdf.addPage();
        
        // A4 dimensions: 210mm x 297mm
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      pdf.save(`GARV_Catalogue_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("An error occurred. If images are missing, you may need to configure Firebase CORS.");
    } finally {
      setStatus('');
      onComplete();
    }
  };

  // Chunk products into arrays of 9 (3x3 grid fits perfectly on an A4 page)
  const chunks = [];
  for (let i = 0; i < products.length; i += 9) {
    chunks.push(products.slice(i, i + 9));
  }

  if (!isGenerating) return null;

  return (
    <>
      {/* ✨ THE LOADING OVERLAY: Hides the messy generation process from the user */}
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17, 17, 17, 0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(212, 175, 55, 0.3)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <h2 style={{ color: '#FFF', fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Generating Catalogue</h2>
        <p style={{ color: '#D4AF37', marginTop: '8px', fontWeight: '600' }}>{status}</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ✨ THE PDF CONTAINER: Placed at top:0 so images load, but hidden behind the overlay (z-index: 100) */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 100 }}>
        <div ref={containerRef}>
          {chunks.map((chunk, pageIndex) => (
            <div 
              key={pageIndex} 
              style={{ 
                width: '794px', height: '1123px', backgroundColor: '#FFF', 
                padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                fontFamily: 'Helvetica, Arial, sans-serif'
              }}
            >
              {/* CATALOGUE HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #D4AF37', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '1px' }}>GARV <span style={{ color: '#D4AF37', fontWeight: '300' }}>GIFT GALLERY</span></h1>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Premium Corporate & Gifting Collection</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Date: {new Date().toLocaleDateString('en-IN')}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#111', fontWeight: 'bold' }}>Page {pageIndex + 1} of {chunks.length}</p>
                </div>
              </div>

              {/* PRODUCT GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', flex: 1 }}>
                {chunk.map(product => {
                  const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : (product.image || 'https://via.placeholder.com/300?text=No+Image');
                  
                  // Determine which price to show based on Admin's selection
                  let displayPrice = 0;
                  let priceLabel = '';
                  if (pricingMode === 'retail') { displayPrice = product.retail; priceLabel = 'Retail'; }
                  else if (pricingMode === 'wholesale') { displayPrice = product.ws; priceLabel = 'Wholesale'; }
                  else if (pricingMode === 'bulk') { displayPrice = product.bulk; priceLabel = 'Bulk'; }

                  const hasVariants = product.variants && product.variants.length > 0;

                  return (
                    <div key={product.id} style={{ border: '1px solid #EAEAEA', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '280px', backgroundColor: '#FFF' }}>
                      <div style={{ height: '160px', backgroundColor: '#FAFAFA', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderBottom: '1px solid #F5F5F5' }}>
                        {/* crossOrigin MUST be anonymous for html2canvas to fetch it properly if CORS is enabled */}
                        <img src={imgUrl} alt={product.name} style={{ width: '90%', height: '90%', objectFit: 'contain' }} crossOrigin="anonymous" />
                      </div>
                      
                      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        
                        {/* ✨ FIXED: Reliable block layout for the name instead of broken Webkit Clamps */}
                        <div style={{ height: '36px', overflow: 'hidden', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#111', lineHeight: '1.4' }}>
                            {product.name || product.title || "Unnamed"}
                          </h3>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                          {pricingMode !== 'none' ? (
                            <div>
                              <p style={{ margin: 0, fontSize: '9px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold' }}>{priceLabel}</p>
                              <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#111' }}>₹{displayPrice}</p>
                            </div>
                          ) : (
                            <div style={{ flex: 1 }}>
                              {hasVariants && <span style={{ fontSize: '9px', backgroundColor: '#F9F8F6', border: '1px solid #D4AF37', color: '#D4AF37', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>OPTIONS AVAILABLE</span>}
                            </div>
                          )}
                          
                          <div style={{ textAlign: 'right', backgroundColor: '#FAFAFA', padding: '4px 8px', borderRadius: '4px', border: '1px solid #EAEAEA' }}>
                             <p style={{ margin: 0, fontSize: '9px', color: '#666' }}>MOQ: <b style={{ color: '#111' }}>{product.retailMoq || product.moq || 1}</b></p>
                             {product.packSize > 1 && <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#666' }}>Pack: <b style={{ color: '#111' }}>{product.packSize}</b></p>}
                          </div>
                        </div>

                      </div>
                    </div>
                  )
                })}
              </div>

              {/* CATALOGUE FOOTER */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#666', fontWeight: '500' }}>Confidential & Proprietary • Prices & availability subject to change.</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#111', fontWeight: '800' }}>WhatsApp Orders: +91 88519 90042</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default CatalogueGenerator;