import React from 'react';
import { FaWhatsapp, FaInstagram, FaMapMarkerAlt } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-[#111111] py-12 px-6 sm:px-12 border-t border-gray-800 w-full">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* Left Column: Brand Info */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left pr-0 md:pr-8">
          <h3 className="text-white text-lg font-bold tracking-wide mb-2">GARV GIFT GALLERY</h3>
          <p className="text-[#D4AF37] text-sm font-medium mb-3">A Unit of VR International</p>
          <p className="text-gray-300 text-sm leading-relaxed max-w-xs">
            Premium B2B & B2C gifting solutions offering an exclusive catalogue of high-quality products.
          </p>
        </div>

        {/* Center Column: Contact Details & Socials */}
        <div className="flex flex-col items-center md:items-center text-center">
          <h3 className="text-white text-lg font-bold tracking-wide mb-4">Contact Us</h3>
          
          <a 
            href="https://maps.app.goo.gl/Bntmb1mzTb99TfWJA" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-300 text-sm hover:text-[#D4AF37] transition-colors mb-3"
          >
            <FaMapMarkerAlt className="text-[#D4AF37]" size={16} />
            <span>Sadar Bazar, Delhi - 110006</span>
          </a>
          
          <a href="mailto:garvgiftgallery@gmail.com" className="text-gray-300 text-sm hover:text-[#D4AF37] transition-colors mb-6">
            info@garvgiftgallery.com
          </a>

          {/* Social Icons - Now permanently gold for better contrast */}
          <div className="flex gap-6">
            <a 
              href="https://wa.me/918851990042" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#D4AF37] hover:text-white transition-colors"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={22} />
            </a>
            <a 
              href="https://www.instagram.com/garvgiftgallery" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#D4AF37] hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <FaInstagram size={22} />
            </a>
          </div>
        </div>

        {/* Right Column: Quick Links */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right">
          <h3 className="text-white text-lg font-bold tracking-wide mb-4">Quick Links</h3>
          {/* Added md:items-end here to force the links to align cleanly to the right edge */}
          <ul className="flex flex-col items-center md:items-end gap-3">
            <li>
              <a href="#" className="text-gray-300 text-sm hover:text-[#D4AF37] transition-colors">
                Refund Policy
              </a>
            </li>
            <li>
              <a href="#" className="text-gray-300 text-sm hover:text-[#D4AF37] transition-colors">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="#" className="text-gray-300 text-sm hover:text-[#D4AF37] transition-colors">
                Terms & Conditions
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright */}
      <div className="max-w-[1400px] mx-auto mt-12 pt-6 border-t border-gray-800/60 text-center">
        <p className="text-gray-500 text-xs tracking-wider">
          © {new Date().getFullYear()} Garv Gift Gallery by VR International. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;