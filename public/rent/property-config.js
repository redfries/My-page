/**
 * Property Configuration & Content Data
 * -------------------------------------------------------------
 * You can edit any details in this file (rent, location, specs,
 * amenities, phone number, and photos) to customize your listing.
 */

window.PROPERTY_CONFIG = {
  // --- Basic Identity & Meta ---
  title: "Modern 3 BHK Luxury Residence",
  tagline: "Spacious, Sunlit Living with Panoramic Green Views",
  status: "Available for Rent",
  directFromOwner: true, // Highlights 0% brokerage fees
  ownershipType: "Direct Owner Listing",

  // --- Pricing & Terms ---
  currency: "₹",
  monthlyRent: 45000,
  rentDisplay: "₹45,000",
  rentPeriod: "/ month",
  securityDeposit: "₹1,50,000", // e.g. 3-4 months refundable
  maintenance: "₹3,500 / month (includes water, security, common lights)",
  leaseTerm: "11 Months (Renewable)",
  lockInPeriod: "6 Months",
  noticePeriod: "1 Month",
  brokerage: "ZERO (0% Brokerage Fee — Direct from Owner)",

  // --- Key Highlights ---
  highlights: [
    { label: "Configuration", value: "3 BHK + 3 Baths" },
    { label: "Carpet Area", value: "1,850 sq.ft" },
    { label: "Super Area", value: "2,150 sq.ft" },
    { label: "Orientation", value: "East-Facing (Vastu)" },
    { label: "Floor Level", value: "2nd Floor (with Lift)" },
    { label: "Parking", value: "2 Covered Car Parks" },
    { label: "Furnishing", value: "Semi-Furnished" },
    { label: "Available From", value: "Immediate / Dec 1" },
  ],

  // --- Owner Contact Info ---
  owner: {
    name: "Shabaaz Hussain",
    phone: "+91 70133 71541",
    phoneAlt: "+91 98486 59417",
    whatsapp: "+917013371541",
    email: "studioinfinitys@gmail.com",
    viewingHours: "10:00 AM – 8:00 PM (All days by appointment)",
  },

  // --- Location & Landmarks ---
  location: {
    neighborhood: "Greenwood Enclave, Phase 2", // Replace with your area
    city: "Bengaluru, Karnataka", // Replace with your city
    fullAddress: "Villa 42, Palm Avenue, Greenwood Enclave, Near Metro Station", // Replace with address
    googleMapsUrl: "https://maps.google.com/?q=Bangalore",
    landmarks: [
      { name: "Metro Station", distance: "800 m", time: "5 min walk", icon: "train" },
      { name: "Daily Needs Supermarket", distance: "250 m", time: "2 min walk", icon: "shopping-bag" },
      { name: "Multi-Speciality Hospital", distance: "1.8 km", time: "6 min drive", icon: "plus-circle" },
      { name: "International School", distance: "2.4 km", time: "8 min drive", icon: "book-open" },
      { name: "IT Park & Tech Corridor", distance: "4.5 km", time: "12 min drive", icon: "briefcase" },
      { name: "International Airport", distance: "32 km", time: "38 min drive", icon: "navigation" },
    ]
  },

  // --- Detailed Specifications ---
  specifications: [
    {
      category: "Living & Dining",
      items: [
        "Spacious open-plan living room with Italian vitrified tiling",
        "Floor-to-ceiling sliding glass doors opening into a private balcony",
        "Designer warm LED false ceiling with ambient cove lighting",
        "Dedicated dining alcove comfortably seating 8 guests",
        "High ceilings (10.5 ft) providing exceptional airflow"
      ]
    },
    {
      category: "Master Bedroom & Suites",
      items: [
        "King-sized master bedroom with premium engineered wooden flooring",
        "Custom floor-to-ceiling wardrobes with integrated soft-close drawers",
        "Attached en-suite bathroom with glass-partitioned shower enclosure",
        "Direct private balcony overlooking landscaped greenery",
        "Pre-installed AC conduits, TV wall mount, and blackout curtain rods"
      ]
    },
    {
      category: "Kitchen & Utility",
      items: [
        "Modular European-style kitchen with high-gloss soft-close cabinetry",
        "Quartz stone countertop with undermount stainless steel double sink",
        "Installed 4-burner Faber gas hob and high-suction chimney",
        "Dedicated utility/laundry area with washing machine inlet & drainage",
        "Concealed copper piped gas line connection ready"
      ]
    },
    {
      category: "Bathrooms & Fittings",
      items: [
        "3 full bathrooms with premium Jaquar / Kohler sanitaryware & faucets",
        "Instant geysers installed in all bathrooms",
        "Anti-skid matte ceramic tiles with separate wet and dry zones",
        "Granite vanity counter with large illuminated mirror cabinets",
        "High-pressure water pump and dual-flush water-saving systems"
      ]
    },
    {
      category: "Utilities & Security",
      items: [
        "24/7 dual water supply (Cauvery / Municipal water + high-yield Borewell)",
        "100% Inverter power backup for lights, fans, Wi-Fi, and refrigerator",
        "Digital Smart Door Lock (Fingerprint, RFID card, PIN, and Key access)",
        "24/7 CCTV surveillance across perimeter, gate, and parking lot",
        "High-speed fiber-optic broadband pre-wired (Airtel / Jio)"
      ]
    }
  ],

  // --- Amenities Grid ---
  amenities: [
    { title: "2 Covered Car Parking", desc: "Spacious stilt parking with EV charging socket", icon: "car" },
    { title: "Dual Water Supply", desc: "24/7 municipal + borewell connection with RO point", icon: "droplet" },
    { title: "100% Power Backup", desc: "Automatic inverter backup for uninterrupted power", icon: "zap" },
    { title: "Digital Smart Lock", desc: "Keyless entry via fingerprint, passcode, or app", icon: "shield" },
    { title: "Private Green Balconies", desc: "Unobstructed sunrise views and excellent ventilation", icon: "sun" },
    { title: "Modular Kitchen", desc: "Fitted with chimney, hob, pantry pull-outs, and quartz slab", icon: "grid" },
    { title: "High-Speed Fiber Ready", desc: "Cat-6 cabling with Wi-Fi mesh coverage in every room", icon: "wifi" },
    { title: "Passenger Elevator", desc: "Smooth automatic lift connecting parking to your door", icon: "arrow-up" },
    { title: "Pet & Family Friendly", desc: "Child-safe balcony railings and peaceful community", icon: "heart" },
    { title: "24/7 Security & CCTV", desc: "Secure gated perimeter with intercom connection", icon: "lock" }
  ],

  // --- Photo Gallery ---
  // High-res architectural photography samples. Replace with your own photos anytime!
  photos: [
    {
      id: 1,
      category: "living",
      title: "Expansive Living Room",
      caption: "Bathed in natural morning light with Italian vitrified tiling and warm ambient lighting.",
      dimensions: "24' × 15'",
      url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
      featured: true
    },
    {
      id: 2,
      category: "dining",
      title: "Open Dining & Lounge",
      caption: "Seamless flow from living to dining, designed for comfortable family dinners and entertaining.",
      dimensions: "16' × 12'",
      url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
      featured: false
    },
    {
      id: 3,
      category: "bedroom",
      title: "Master Bedroom Suite",
      caption: "Spacious master bedroom with wooden textures, en-suite bath, and floor-to-ceiling wardrobes.",
      dimensions: "18' × 14'",
      url: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1600&q=80",
      featured: true
    },
    {
      id: 4,
      category: "bedroom",
      title: "Second Bedroom / Guest Suite",
      caption: "Ample ventilation, large windows, modular study desk corner, and attached wardrobe.",
      dimensions: "15' × 13'",
      url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1600&q=80",
      featured: false
    },
    {
      id: 5,
      category: "kitchen",
      title: "Modular Chef's Kitchen",
      caption: "Fitted with high-gloss soft-close cabinetry, 4-burner hob, chimney, and separate utility space.",
      dimensions: "14' × 10'",
      url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=80",
      featured: false
    },
    {
      id: 6,
      category: "bathroom",
      title: "Designer Bathroom",
      caption: "Modern glass shower cubicle, anti-skid tiles, premium fixtures, and instant geyser.",
      dimensions: "9' × 7'",
      url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=80",
      featured: false
    },
    {
      id: 7,
      category: "balcony",
      title: "Sunlit Private Balcony",
      caption: "Peaceful morning coffee nook with unobstructed green foliage and gentle breeze.",
      dimensions: "16' × 6'",
      url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
      featured: false
    },
    {
      id: 8,
      category: "exterior",
      title: "Building Facade & Entry",
      caption: "Gated residential enclave with secure automated gate and covered stilt parking.",
      dimensions: "Independent Entry",
      url: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80",
      featured: false
    }
  ],

  // --- Preferred Tenant Profile ---
  tenantPreferences: {
    preference: "Families, Working IT/Corporate Professionals, or Expats",
    pets: "Allowed (with basic pet etiquette)",
    smoking: "Outdoor balcony only",
    dietary: "No restrictions",
  },

  // --- QR Code & Physical Flyer Settings ---
  qrSettings: {
    liveUrl: "https://www.infinitys.me/rent/",
    shortCode: "infinitys.me/rent",
    headline: "Scan to Tour This Home Online",
    subtext: "High-resolution photos, detailed specifications, floor plan, and direct owner contact."
  }
};
