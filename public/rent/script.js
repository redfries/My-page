/**
 * The Residence — Interactive Rental Engine & QR Flyer Generator
 * Domain: infinitys.me/rent
 */

(function () {
  'use strict';

  const cfg = window.PROPERTY_CONFIG || {};

  // State
  let currentFilter = 'all';
  let currentLightboxIndex = 0;
  let filteredPhotos = [];

  // DOM Elements
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryTabs = document.querySelectorAll('.gallery-tab');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');

  // --- Initialize Dynamic Content ---
  function initContent() {
    // Page Title
    if (cfg.title) {
      document.title = `${cfg.title} | Direct Owner Rent — infinitys.me/rent`;
    }

    // Rent displays
    const rentAmountEl = document.getElementById('rent-amount-val');
    if (rentAmountEl && cfg.rentDisplay) {
      rentAmountEl.textContent = cfg.rentDisplay;
    }
    const stickyRentVal = document.getElementById('sticky-rent-val');
    if (stickyRentVal && cfg.rentDisplay) {
      stickyRentVal.textContent = cfg.rentDisplay;
    }

    // Owner info in form and contact cards
    const ownerNameEls = document.querySelectorAll('.owner-name-val');
    ownerNameEls.forEach(el => el.textContent = cfg.owner?.name || 'Owner');

    const ownerPhoneEls = document.querySelectorAll('.owner-phone-val');
    const displayPhones = cfg.owner?.phoneAlt 
      ? `${cfg.owner.phone} / ${cfg.owner.phoneAlt}`
      : (cfg.owner?.phone || '+91 70133 71541');
    ownerPhoneEls.forEach(el => el.textContent = displayPhones);

    const ownerEmailEls = document.querySelectorAll('.owner-email-val');
    ownerEmailEls.forEach(el => el.textContent = cfg.owner?.email || 'studioinfinitys@gmail.com');

    // Phone / WhatsApp links
    const phoneClean = (cfg.owner?.phone || '').replace(/[^0-9+]/g, '');
    const waClean = (cfg.owner?.whatsapp || cfg.owner?.phone || '').replace(/[^0-9]/g, '');
    
    const callBtns = document.querySelectorAll('.btn-action-call');
    callBtns.forEach(btn => {
      btn.href = `tel:${phoneClean}`;
    });

    const defaultMsg = encodeURIComponent(
      `Hello ${cfg.owner?.name || 'Sir'}, I saw your house rental listing on infinitys.me/rent (${cfg.title || 'Property'}) and would like to schedule a viewing.`
    );

    const waBtns = document.querySelectorAll('.btn-action-whatsapp');
    waBtns.forEach(btn => {
      btn.href = `https://wa.me/${waClean}?text=${defaultMsg}`;
    });

    // Render Highlights Ribbon
    renderHighlightsRibbon();

    // Render Specifications
    renderSpecifications();

    // Render Amenities
    renderAmenities();

    // Render Neighborhood Landmarks
    renderLandmarks();

    // Render Initial Gallery
    filterGallery('all');

    // Initialize QR Code generator
    initQRCode();
  }

  // --- Highlights Ribbon ---
  function renderHighlightsRibbon() {
    const ribbon = document.getElementById('specs-ribbon');
    if (!ribbon || !cfg.highlights) return;

    ribbon.innerHTML = cfg.highlights.map(h => `
      <div class="spec-ribbon-item">
        <span class="spec-ribbon-label">${h.label}</span>
        <span class="spec-ribbon-val">${h.value}</span>
      </div>
    `).join('');
  }

  // --- Specifications Accordion/Grid ---
  function renderSpecifications() {
    const specsContainer = document.getElementById('specs-grid');
    if (!specsContainer || !cfg.specifications) return;

    specsContainer.innerHTML = cfg.specifications.map(cat => `
      <div class="spec-category-card">
        <h3 class="spec-category-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          ${cat.category}
        </h3>
        <ul class="spec-items-list">
          ${cat.items.map(item => `
            <li class="spec-item">
              <span class="spec-item-bullet">✦</span>
              <span>${item}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');
  }

  // --- Amenities Grid ---
  function renderAmenities() {
    const amenitiesContainer = document.getElementById('amenities-grid');
    if (!amenitiesContainer || !cfg.amenities) return;

    // SVG icon mapping
    const icons = {
      car: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>`,
      droplet: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`,
      zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
      shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
      sun: `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`,
      grid: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
      wifi: `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`,
      "arrow-up": `<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>`,
      heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
      lock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`
    };

    amenitiesContainer.innerHTML = cfg.amenities.map(a => `
      <div class="amenity-card">
        <div class="amenity-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${icons[a.icon] || icons.shield}
          </svg>
        </div>
        <div class="amenity-title">${a.title}</div>
        <div class="amenity-desc">${a.desc}</div>
      </div>
    `).join('');
  }

  // --- Landmarks ---
  function renderLandmarks() {
    const landmarksContainer = document.getElementById('landmarks-grid');
    if (!landmarksContainer || !cfg.location?.landmarks) return;

    landmarksContainer.innerHTML = cfg.location.landmarks.map(lm => `
      <div class="landmark-card">
        <div class="landmark-title">${lm.name}</div>
        <div class="landmark-meta">
          <span>${lm.distance}</span>
          <span>•</span>
          <span class="landmark-time">${lm.time}</span>
        </div>
      </div>
    `).join('');

    const addressText = document.getElementById('full-address-text');
    if (addressText && cfg.location?.fullAddress) {
      addressText.textContent = cfg.location.fullAddress;
    }

    const mapsBtn = document.getElementById('btn-google-maps');
    if (mapsBtn && cfg.location?.googleMapsUrl) {
      mapsBtn.href = cfg.location.googleMapsUrl;
    }
  }

  // --- Gallery Filtering & Lightbox ---
  function filterGallery(category) {
    currentFilter = category;
    const allPhotos = cfg.photos || [];

    if (category === 'all') {
      filteredPhotos = allPhotos;
    } else {
      filteredPhotos = allPhotos.filter(p => p.category === category);
    }

    if (!galleryGrid) return;

    galleryGrid.innerHTML = filteredPhotos.map((photo, idx) => {
      // span classes for asymmetric editorial bento layout
      let spanClass = 'span-4';
      if (idx === 0 || idx === 3) spanClass = 'span-6';
      if (idx === 4) spanClass = 'span-8';

      return `
        <div class="gallery-item ${spanClass}" data-index="${idx}">
          <img src="${photo.url}" alt="${photo.title}" loading="lazy" />
          <div class="gallery-item-info">
            <div class="gallery-item-title">${photo.title}</div>
            <div class="gallery-item-dim">${photo.dimensions || ''}</div>
          </div>
          <div class="gallery-zoom-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers to open lightbox
    const items = galleryGrid.querySelectorAll('.gallery-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-index'), 10);
        openLightbox(idx);
      });
    });
  }

  // Category tab clicks
  galleryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      galleryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.getAttribute('data-category');
      filterGallery(cat);
    });
  });

  // Lightbox functionality
  function openLightbox(index) {
    if (!filteredPhotos.length) return;
    currentLightboxIndex = index;
    updateLightbox();
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const photo = filteredPhotos[currentLightboxIndex];
    if (!photo) return;

    lightboxImg.src = photo.url;
    lightboxImg.alt = photo.title;
    lightboxTitle.textContent = photo.title;
    lightboxCaption.textContent = `${photo.caption || ''} • Room Dimensions: ${photo.dimensions || 'N/A'}`;
    lightboxCounter.textContent = `${currentLightboxIndex + 1} of ${filteredPhotos.length}`;
  }

  function nextPhoto() {
    currentLightboxIndex = (currentLightboxIndex + 1) % filteredPhotos.length;
    updateLightbox();
  }

  function prevPhoto() {
    currentLightboxIndex = (currentLightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    updateLightbox();
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxNext) lightboxNext.addEventListener('click', nextPhoto);
  if (lightboxPrev) lightboxPrev.addEventListener('click', prevPhoto);

  // Close on outside click
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (!lightboxModal.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
  });

  // --- QR Code Generator for Paper Ad Flyer ---
  function initQRCode() {
    const targetUrl = cfg.qrSettings?.liveUrl || 'https://www.infinitys.me/rent/';
    const container = document.getElementById('qr-canvas-box');
    if (!container) return;

    // Use reliable high-precision QR API to render high-contrast SVG / PNG
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(targetUrl)}`;

    container.innerHTML = `
      <img id="flyer-qr-image" src="${qrApiUrl}" alt="QR Code for ${targetUrl}" crossOrigin="anonymous" />
    `;

    // Download QR Code button
    const downloadBtn = document.getElementById('btn-download-qr');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        try {
          const resp = await fetch(qrApiUrl);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'infinitys-rent-qr-code.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } catch (err) {
          window.open(qrApiUrl, '_blank');
        }
      });
    }

    // Print Flyer Card button
    const printBtn = document.getElementById('btn-print-flyer');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  // --- Inquiry Form Submission ---
  const inquiryForm = document.getElementById('inquiry-form');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('form-name')?.value || 'Prospective Tenant';
      const phone = document.getElementById('form-phone')?.value || '';
      const date = document.getElementById('form-date')?.value || 'Earliest possible';
      const message = document.getElementById('form-message')?.value || '';

      const waClean = (cfg.owner?.whatsapp || cfg.owner?.phone || '').replace(/[^0-9]/g, '');

      const text = encodeURIComponent(
        `Hello ${cfg.owner?.name || 'Owner'},\n\nI am interested in renting your property listed at infinitys.me/rent (${cfg.title || 'Property'}).\n\nName: ${name}\nPhone: ${phone}\nPreferred Viewing Date: ${date}\nNotes: ${message}`
      );

      // Open WhatsApp chat directly with inquiry details
      window.open(`https://wa.me/${waClean}?text=${text}`, '_blank');
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContent);
  } else {
    initContent();
  }
})();
