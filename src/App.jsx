import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Train, School, Coffee, AlertTriangle, Clock, Navigation, Zap, ShoppingBag, TreePine, Info, Heart, X, Check, TrendingUp, Building, Users, Moon, Sun, ExternalLink, Calendar, Search, ArrowRight, Eye } from 'lucide-react';

// IMPORTANT: Add your Google Maps API key here
const GOOGLE_MAPS_API_KEY = 'AIzaSyBxU6OMCZvkLLbcjo4bXoyQOHg02VZ8gok'; // Replace with your actual API key

// Logo Component
const NeighborScopeLogo = ({ size = 'md', theme = 'dark', className = '' }) => {
  const sizes = {
    sm: { icon: 24, text: 'text-xl' },
    md: { icon: 32, text: 'text-2xl' },
    lg: { icon: 40, text: 'text-3xl' },
    xl: { icon: 48, text: 'text-4xl' }
  };
  
  const { icon, text } = sizes[size];
  
  const colors = theme === 'dark' 
    ? { primary: 'text-purple-400', secondary: 'text-purple-300', text: 'text-white' }
    : { primary: 'text-purple-600', secondary: 'text-purple-500', text: 'text-slate-900' };
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        {/* Icon: Eye with location pin */}
        <div className="relative" style={{ width: icon, height: icon }}>
          <Eye size={icon} className={colors.primary} strokeWidth={2} />
          <MapPin size={icon * 0.5} className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${colors.secondary}`} strokeWidth={2.5} />
        </div>
      </div>
      <span className={`playfair font-bold ${colors.text} ${text}`}>
        Neighborhood<span className={colors.primary}>Scope</span>
      </span>
    </div>
  );
};

// URL Parser - Extracts address from Zillow, Redfin, Realtor.com URLs
const parsePropertyURL = (input) => {
  const cleanInput = input.trim();
  
  // If it's not a URL, assume it's a plain address
  if (!cleanInput.includes('http') && !cleanInput.includes('.com')) {
    return cleanInput;
  }
  
  try {
    // Zillow URL parsing
    if (cleanInput.includes('zillow.com')) {
      // Example: zillow.com/homedetails/123-Main-St-Garden-City-NY-11530/12345_zpid/
      const match = cleanInput.match(/homedetails\/([^\/]+)/);
      if (match) {
        return match[1].replace(/-/g, ' ').replace(/_zpid.*/, '');
      }
    }
    
    // Redfin URL parsing
    if (cleanInput.includes('redfin.com')) {
      // Example: redfin.com/NY/Garden-City/123-Main-St-11530/home/12345
      const match = cleanInput.match(/\/([^\/]+)\/home\//);
      if (match) {
        return match[1].replace(/-/g, ' ');
      }
    }
    
    // Realtor.com URL parsing
    if (cleanInput.includes('realtor.com')) {
      // Example: realtor.com/realestateandhomes-detail/123-Main-St_Garden-City_NY_11530
      const match = cleanInput.match(/detail\/([^?]+)/);
      if (match) {
        return match[1].replace(/_/g, ' ').replace(/-/g, ' ');
      }
    }
    
    return cleanInput;
  } catch (e) {
    return cleanInput;
  }
};

// Geocoding function
const geocodeAddress = async (address) => {
  try {
    // Wait for Google Maps to be available
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not loaded yet');
      return null;
    }

    const geocoder = new window.google.maps.Geocoder();
    
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: address }, (results, status) => {
        console.log('Geocode status:', status);
        console.log('Geocode results:', results);
        
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];
          resolve({
            coords: {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng()
            },
            formattedAddress: result.formatted_address
          });
        } else {
          console.error('Geocoding failed with status:', status);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// NEW: Calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
};

// NEW: Calculate walk time
const calculateWalkTime = (distanceMiles) => {
  return Math.round((parseFloat(distanceMiles) / 3) * 60); // 3 mph walking speed
};

// NEW: Fetch dynamic nearby places from Google Places API
const fetchNearbyPlaces = async (lat, lng) => {
  const results = {
    schools: [],
    transit: [],
    cafes: [],
    amenities: []
  };

  try {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.warn('Google Places API not loaded yet');
      return null; // Return null so we can use fallback
    }

    const service = new window.google.maps.places.PlacesService(document.createElement('div'));

    // Helper to promisify nearbySearch
    const searchNearby = (request) => {
      return new Promise((resolve) => {
        service.nearbySearch(request, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            resolve(results);
          } else {
            console.warn(`Places search failed: ${status}`);
            resolve([]);
          }
        });
      });
    };

    console.log('🔍 Fetching nearby places for:', lat, lng);

    // Schools (radius: 3000m)
    const schoolResults = await searchNearby({
      location: new window.google.maps.LatLng(lat, lng),
      radius: 3000,
      type: 'school'
    });
    
    results.schools = schoolResults.slice(0, 5).map(place => {
      const distance = calculateDistance(lat, lng, place.geometry.location.lat(), place.geometry.location.lng());
      return {
        name: place.name,
        distance: parseFloat(distance),
        walkTime: calculateWalkTime(distance),
        rating: place.rating ? Math.round(place.rating * 2) : 8,
        type: place.types.includes('primary_school') ? 'Public Elementary' : 
              place.types.includes('secondary_school') ? 'Public High School' : 'School'
      };
    });

    // Transit (radius: 5000m)
    const transitResults = await searchNearby({
      location: new window.google.maps.LatLng(lat, lng),
      radius: 5000,
      type: 'transit_station'
    });
    
    results.transit = transitResults.slice(0, 3).map(place => {
      const distance = calculateDistance(lat, lng, place.geometry.location.lat(), place.geometry.location.lng());
      return {
        name: place.name,
        distance: parseFloat(distance),
        walkTime: calculateWalkTime(distance),
        line: place.vicinity || 'Transit Station',
        toPennStation: null // We don't have this data
      };
    });

    // Cafes (radius: 2000m)
    const cafeResults = await searchNearby({
      location: new window.google.maps.LatLng(lat, lng),
      radius: 2000,
      type: 'cafe'
    });
    
    results.cafes = cafeResults.slice(0, 3).map(place => {
      const distance = calculateDistance(lat, lng, place.geometry.location.lat(), place.geometry.location.lng());
      return {
        name: place.name,
        distance: parseFloat(distance),
        walkTime: calculateWalkTime(distance)
      };
    });

    // Grocery
    const groceryResults = await searchNearby({
      location: new window.google.maps.LatLng(lat, lng),
      radius: 3000,
      type: 'grocery_or_supermarket'
    });
    
    if (groceryResults.length > 0) {
      const grocery = groceryResults[0];
      const distance = calculateDistance(lat, lng, grocery.geometry.location.lat(), grocery.geometry.location.lng());
      results.amenities.push({
        name: grocery.name,
        distance: parseFloat(distance),
        type: 'Grocery',
        icon: 'shopping'
      });
    }

    // Parks
    const parkResults = await searchNearby({
      location: new window.google.maps.LatLng(lat, lng),
      radius: 3000,
      type: 'park'
    });
    
    if (parkResults.length > 0) {
      const park = parkResults[0];
      const distance = calculateDistance(lat, lng, park.geometry.location.lat(), park.geometry.location.lng());
      results.amenities.push({
        name: park.name,
        distance: parseFloat(distance),
        type: 'Park',
        icon: 'park'
      });
    }

    // Shopping
    const shoppingResults = await searchNearby({
      location: new window.google.maps.LatLng(lat, lng),
      radius: 5000,
      type: 'shopping_mall'
    });
    
    if (shoppingResults.length > 0) {
      const mall = shoppingResults[0];
      const distance = calculateDistance(lat, lng, mall.geometry.location.lat(), mall.geometry.location.lng());
      results.amenities.push({
        name: mall.name,
        distance: parseFloat(distance),
        type: 'Shopping',
        icon: 'shopping'
      });
    }

    console.log('✅ Nearby places fetched:', results);
    return results;

  } catch (error) {
    console.error('Error fetching nearby places:', error);
    return null; // Return null so we can use fallback
  }
};

// Real properties in Garden City, NY
const SAMPLE_PROPERTIES = [
  {
    id: 1,
    address: "722 Steiner Street, San Francisco, CA 94117",
    coords: { lat: 37.7765, lng: -122.4350 },
    price: "$4,200,000",
    beds: 4,
    baths: 3,
    lifestyleMatch: 92,
    commuteTime: 47,
    dealBreakers: 1
  },
  {
    id: 2,
    address: "131 Pierrepont Street, Brooklyn, NY 11201",
    coords: { lat: 40.6949, lng: -73.9957 },
    price: "$3,800,000",
    beds: 4,
    baths: 3.5,
    lifestyleMatch: 85,
    commuteTime: 51,
    dealBreakers: 0
  },
  {
    id: 3,
    address: "1800 N Burling Street, Chicago, IL 60614",
    coords: { lat: 41.9149, lng: -87.6538 },
    price: "$2,200,000",
    beds: 4,
    baths: 3,
    lifestyleMatch: 88,
    commuteTime: 44,
    dealBreakers: 2
  }
];

const NEARBY_LOCATIONS = {
  schools: [
    { name: "Garden City High School", distance: 0.3, walkTime: 6, rating: 9, type: "Public High School" },
    { name: "Locust Elementary", distance: 0.5, walkTime: 10, rating: 8, type: "Public Elementary" },
    { name: "St. Anne's School", distance: 0.7, walkTime: 14, rating: 9, type: "Private K-8" }
  ],
  transit: [
    { name: "Garden City LIRR Station", distance: 0.6, walkTime: 12, line: "Hempstead Branch", toPennStation: 35 },
    { name: "Mineola LIRR Station", distance: 1.2, walkTime: 24, line: "Main Line", toPennStation: 32 }
  ],
  cafes: [
    { name: "Starbucks (7th St)", distance: 0.4, walkTime: 8 },
    { name: "Local Coffee Shop", distance: 0.3, walkTime: 6 },
    { name: "The Bryant Library Cafe", distance: 0.5, walkTime: 10 }
  ],
  amenities: [
    { name: "Roosevelt Field Mall", distance: 1.5, type: "Shopping", icon: "shopping" },
    { name: "Eisenhower Park", distance: 2.1, type: "Park", icon: "park" },
    { name: "Whole Foods", distance: 0.8, type: "Grocery", icon: "shopping" }
  ]
};

// Property-specific concerns (matches dealBreakers count)
const PROPERTY_CONCERNS = {
  1: [
    { type: "Power Lines", distance: 0.2, severity: "moderate", description: "Overhead power lines along Stewart Ave" }
  ],
  2: [], // No concerns
  3: [
    { type: "Power Lines", distance: 0.2, severity: "moderate", description: "Overhead power lines along Stewart Ave" },
    { type: "Busy Road", distance: 0.1, severity: "low", description: "Franklin Avenue has moderate traffic" }
  ]
};

const FUTURE_DEVELOPMENTS = [
  {
    type: "Residential Construction",
    location: "Corner of Franklin & Stewart",
    distance: 0.3,
    status: "Approved",
    impact: "positive",
    description: "New 12-unit townhome development. May increase property values but expect construction noise for 18 months."
  },
  {
    type: "Infrastructure",
    location: "7th Street Repaving",
    distance: 0.1,
    status: "Scheduled 2025",
    impact: "neutral",
    description: "Road improvement project scheduled for Spring 2025. Brief traffic disruption expected."
  }
];

const TIME_OF_DAY_INSIGHTS = {
  morning: {
    traffic: "Moderate traffic 7-9 AM due to school drop-offs",
    noise: "Residential quiet. Birds chirping, minimal street noise.",
    activity: "Parents walking kids to school, joggers in neighborhood"
  },
  afternoon: {
    traffic: "Light traffic midday",
    noise: "Very quiet residential area",
    activity: "Minimal foot traffic, occasional dog walkers"
  },
  evening: {
    traffic: "Moderate 5-7 PM commuter traffic on main roads",
    noise: "Residential quiet returns by 8 PM",
    activity: "Families returning home, some evening dog walkers"
  },
  night: {
    traffic: "Very light traffic after 10 PM",
    noise: "Extremely quiet. Well-lit streets.",
    activity: "Minimal activity. Safe, well-patrolled neighborhood"
  }
};

const LOCATION_INSIGHTS = {
  walkability: 85,
  transitScore: 78,
  schoolQuality: 92,
  noise: "Low",
  safety: "Excellent",
  summary: "Highly desirable family-oriented suburban location with excellent schools and easy LIRR access to Manhattan. Quiet residential streets with minimal through-traffic. Premium neighborhood with strong property values.",
  highlights: [
    "Within walking distance of top-rated Garden City schools",
    "12-minute walk to LIRR for 35-minute commute to Penn Station",
    "Quiet tree-lined street with minimal traffic",
    "Close to village amenities but away from commercial noise"
  ]
};

// Property-specific considerations (matches concerns)
const PROPERTY_CONSIDERATIONS = {
  1: ["Power lines along Stewart Avenue (0.2 mi away)"],
  2: ["Limited late-night dining options in immediate area"],
  3: ["Power lines along Stewart Avenue (0.2 mi away)", "Moderate traffic on Franklin Avenue (0.1 mi away)"]
};

export default function NeighborhoodScope() {
  const [currentView, setCurrentView] = useState('search');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [nearbyData, setNearbyData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const handlePropertySelect = async (property) => {
    setIsLoading(true);
    setSelectedProperty(property);
    
    // Fetch nearby data for the property
    if (property.id !== 'custom') {
      // For sample properties, fetch their nearby data too
      const places = await fetchNearbyPlaces(property.coords.lat, property.coords.lng);
      setNearbyData(places);
    }
    
    setCurrentView('exploration');
    setIsLoading(false);
  };

  const handleBack = () => {
    setCurrentView('search');
    setSelectedProperty(null);
    setNearbyData(null);
  };

  const handleAddressSubmit = async (input) => {
    console.log('🔍 Starting search for:', input);
    setIsLoading(true);
    setSearchError(null);
    
    // Check if API key is set
    if (GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY_HERE') {
      console.error('❌ Google Maps API key not set!');
      setSearchError('Google Maps API key not configured. Please add your API key to line 5 of the code.');
      setIsLoading(false);
      return;
    }
    
    // Parse the URL or address
    console.log('📝 Parsing address...');
    const address = parsePropertyURL(input);
    console.log('✅ Parsed address:', address);
    
    // Geocode the address
    console.log('🗺️ Geocoding address...');
    const result = await geocodeAddress(address);
    console.log('📍 Geocoding result:', result);
    
    if (result) {
      // Create a property object from the geocoded address
      const customProperty = {
        id: 'custom',
        address: result.formattedAddress,
        coords: result.coords,
        price: "Price not available", // User can explore neighborhood even without price
        beds: null,
        baths: null,
        lifestyleMatch: null,
        commuteTime: null,
        dealBreakers: 0
      };
      
      console.log('✅ Property created:', customProperty);
      
      // NEW: Fetch nearby data
      console.log('📍 Fetching nearby places...');
      const places = await fetchNearbyPlaces(result.coords.lat, result.coords.lng);
      console.log('✅ Nearby places:', places);
      setNearbyData(places); // Will be null if fetching fails, which is fine
      
      setSelectedProperty(customProperty);
      setCurrentView('exploration');
      
      // Track the search (Google Analytics will be added)
      if (window.gtag) {
        window.gtag('event', 'property_search', {
          address: result.formattedAddress
        });
      }
    } else {
      console.error('❌ Geocoding failed');
      setSearchError('Could not find that address. Please try a full address like: "123 Main St, Garden City, NY 11530"');
    }
    
    setIsLoading(false);
  };

  // Simple two-view app: search or exploration
  if (currentView === 'search') {
    return (
      <SearchLandingPage 
        onSubmit={handleAddressSubmit}
        onPropertySelect={handlePropertySelect}
        isLoading={isLoading}
        error={searchError}
      />
    );
  }

  return (
    <ExplorationView 
      property={selectedProperty}
      nearbyData={nearbyData}
      onBack={handleBack}
    />
  );
}

// Search Landing Page with Sample Properties
function SearchLandingPage({ onSubmit, onPropertySelect, isLoading, error }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.log('Waiting for Google Maps to load...');
      return;
    }

    if (!inputRef.current) return;

    // Create autocomplete
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' }
    });

    // Listen for place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place.formatted_address) {
        setInput(place.formatted_address);
      }
    });

    console.log('✅ Autocomplete initialized');
  }, []);

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        
        .playfair {
          font-family: 'Playfair Display', serif;
        }
        
        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      {/* Logo - Top Left */}
      <div className="absolute top-8 left-8 z-10">
        <NeighborScopeLogo size="md" />
      </div>

      <div className="container mx-auto px-6 py-20 flex items-center justify-center min-h-screen">
        <div className="max-w-4xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="playfair text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Stop the
              <span className="block mt-2">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Reconnaissance Missions
                </span>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-3 leading-relaxed">
              Explore any home's neighborhood via Street View before you drive there.
            </p>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Smart Tour auto-walks you around the neighborhood showing schools, transit, cafes, and parks.
            </p>
          </div>

          {/* Search Box */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8 mb-8">
            <div className="space-y-4">
              <div>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && input.trim() && !isLoading) {
                          handleSubmit();
                        }
                      }}
                      placeholder="Paste any Zillow/Redfin link or enter an address..."
                      className="w-full px-6 py-5 bg-slate-800/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 text-lg focus:border-purple-500 focus:outline-none transition-all"
                      disabled={isLoading}
                    />
                    <Search className="absolute right-6 top-1/2 transform -translate-y-1/2 text-slate-400" size={24} />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || !input.trim()}
                    className="px-10 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3 transition-all"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Exploring...</span>
                      </>
                    ) : (
                      <>
                        <Eye size={20} />
                        <span>Explore</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Sample Properties */}
            <div className="mt-8 pt-8 border-t border-white/10">
              <h3 className="text-center text-slate-300 font-semibold mb-6 text-lg">Try a sample property:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SAMPLE_PROPERTIES.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => onPropertySelect(property)}
                    disabled={isLoading}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl p-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-white font-semibold mb-1">{property.price}</div>
                    <div className="text-sm text-slate-400 mb-2">{property.beds} beds • {property.baths} baths</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{property.address}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all">
              <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye size={28} className="text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-lg">Smart Tour</h3>
              <p className="text-sm text-slate-400">Auto-walk around the neighborhood showing schools, transit, cafes</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all">
              <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin size={28} className="text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-lg">Any US Address</h3>
              <p className="text-sm text-slate-400">Works for every address in the United States</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all">
              <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <School size={28} className="text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-lg">Real Data</h3>
              <p className="text-sm text-slate-400">Actual schools, transit stations, and amenities with accurate distances</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LifestyleMatcher({ onSubmit, onSkip }) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    priorities: [],
    workLocation: '',
    maxCommute: 60,
    schoolAge: false,
    lifestyle: [],
    dealBreakers: []
  });

  const priorities = [
    { id: 'schools', label: 'Top-Rated Schools', icon: <School size={24} /> },
    { id: 'commute', label: 'Short Commute', icon: <Clock size={24} /> },
    { id: 'walkability', label: 'Walkable Neighborhood', icon: <Coffee size={24} /> },
    { id: 'quiet', label: 'Quiet Streets', icon: <Moon size={24} /> },
    { id: 'transit', label: 'Near Public Transit', icon: <Train size={24} /> },
    { id: 'amenities', label: 'Nearby Amenities', icon: <ShoppingBag size={24} /> }
  ];

  const lifestyleOptions = [
    { id: 'coffee', label: 'Coffee shop culture' },
    { id: 'parks', label: 'Parks & outdoors' },
    { id: 'dining', label: 'Restaurants & nightlife' },
    { id: 'family', label: 'Family-friendly' },
    { id: 'fitness', label: 'Gyms & fitness' },
    { id: 'arts', label: 'Arts & culture' }
  ];

  const dealBreakerOptions = [
    { id: 'powerlines', label: 'Power lines nearby' },
    { id: 'busyroad', label: 'On busy road' },
    { id: 'highway', label: 'Near highway' },
    { id: 'industrial', label: 'Industrial area nearby' },
    { id: 'airports', label: 'Airport noise' }
  ];

  const toggleSelection = (category, id) => {
    setPreferences(prev => ({
      ...prev,
      [category]: prev[category].includes(id)
        ? prev[category].filter(item => item !== id)
        : [...prev[category], id]
    }));
  };

  const handleSubmit = () => {
    onSubmit(preferences);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-6 overflow-auto">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden my-8" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Fixed Header */}
        <div className="p-6 pb-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="playfair text-2xl md:text-3xl font-bold text-slate-900">
              {step === 1 ? 'What matters most to you?' : step === 2 ? 'Your lifestyle' : 'Deal-breakers'}
            </h2>
            <button onClick={onSkip} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
              Skip for now
            </button>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map(num => (
              <div
                key={num}
                className={`h-2 flex-1 rounded-full transition-all ${num <= step ? 'bg-purple-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {step === 1 && (
          <div>
            <p className="text-slate-600 mb-6">Select your top 3 priorities (in order of importance)</p>
            <div className="grid grid-cols-2 gap-4">
              {priorities.map((priority, idx) => (
                <button
                  key={priority.id}
                  onClick={() => toggleSelection('priorities', priority.id)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    preferences.priorities.includes(priority.id)
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={preferences.priorities.includes(priority.id) ? 'text-purple-600' : 'text-slate-400'}>
                      {priority.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-slate-900">{priority.label}</div>
                      {preferences.priorities.includes(priority.id) && (
                        <div className="text-sm text-purple-600">
                          Priority #{preferences.priorities.indexOf(priority.id) + 1}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8">
              <label className="block text-slate-700 font-medium mb-2">Where do you work? (Optional)</label>
              <input
                type="text"
                placeholder="e.g., Manhattan, Long Island City..."
                value={preferences.workLocation}
                onChange={(e) => setPreferences({ ...preferences, workLocation: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-sm text-slate-500 mt-2">We'll calculate commute times for you</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-slate-600 mb-6">What does your ideal neighborhood have?</p>
            <div className="grid grid-cols-2 gap-3">
              {lifestyleOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleSelection('lifestyle', option.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    preferences.lifestyle.includes(option.id)
                      ? 'border-purple-600 bg-purple-50 text-purple-900'
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-8">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.schoolAge}
                  onChange={(e) => setPreferences({ ...preferences, schoolAge: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <span className="text-slate-700 font-medium">I have school-age children</span>
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-slate-600 mb-6">Select any automatic deal-breakers</p>
            <div className="space-y-3">
              {dealBreakerOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleSelection('dealBreakers', option.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between ${
                    preferences.dealBreakers.includes(option.id)
                      ? 'border-red-600 bg-red-50'
                      : 'border-slate-200 hover:border-red-300'
                  }`}
                >
                  <span className={preferences.dealBreakers.includes(option.id) ? 'text-red-900' : 'text-slate-700'}>
                    {option.label}
                  </span>
                  {preferences.dealBreakers.includes(option.id) && (
                    <X className="text-red-600" size={20} />
                  )}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-4">Properties with these issues will be flagged or hidden</p>
          </div>
        )}
        </div>

        {/* Fixed Footer with Navigation */}
        <div className="p-6 bg-white border-t-4 border-purple-600 shadow-lg">
          <div className="flex gap-4">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-lg"
              >
                ← Back
              </button>
            )}
            <button
              onClick={step === 3 ? handleSubmit : () => setStep(step + 1)}
              disabled={step === 1 && preferences.priorities.length === 0}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {step === 3 ? '🎯 Find My Perfect Neighborhood' : `Continue to Step ${step + 1} →`}
            </button>
          </div>
          {step === 1 && preferences.priorities.length === 0 && (
            <p className="text-sm text-red-600 text-center mt-3 font-medium">⚠️ Please select at least one priority to continue</p>
          )}
          {step === 1 && preferences.priorities.length > 0 && (
            <p className="text-sm text-green-600 text-center mt-3 font-medium">✓ {preferences.priorities.length} priorities selected - click Continue!</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LandingPage({ onPropertySelect, onShowMatcher, onBack, userPreferences, comparisonList, onCompare }) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .playfair {
          font-family: 'Playfair Display', serif;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse 3s ease-in-out infinite;
        }

        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }

        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-4px);
        }

        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }

        .match-badge {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
      `}</style>

      {/* Logo - Top Left */}
      <div className="absolute top-8 left-8 z-20">
        <NeighborScopeLogo size="md" />
      </div>

      {/* Back Button */}
      <div className="absolute top-8 right-8 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all"
        >
          <ArrowRight size={18} className="rotate-180" />
          <span>Back to Search</span>
        </button>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="opacity-0 animate-fadeInUp">
            <h1 className="playfair text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Stop the
              <span className="gradient-text"> Reconnaissance Missions</span>
            </h1>
          </div>
          
          <div className="opacity-0 animate-fadeInUp delay-100">
            <p className="text-xl text-slate-300 mb-12 leading-relaxed">
              Know exactly what's around your future home before you drive there.
              <br />Power lines, train stations, schools, cafes — all in one intelligent view.
            </p>
          </div>

          {/* Lifestyle Matcher CTA */}
          {!userPreferences && (
            <div className="opacity-0 animate-fadeInUp delay-200 mb-8">
              <button
                onClick={onShowMatcher}
                className="btn-primary text-white px-8 py-4 rounded-xl font-medium text-lg animate-pulse-slow inline-flex items-center gap-3"
              >
                <Zap size={24} />
                Get AI-Matched Properties
              </button>
              <p className="text-slate-400 text-sm mt-3">Answer 3 quick questions to see your perfect neighborhoods</p>
            </div>
          )}

          {userPreferences && (
            <div className="opacity-0 animate-fadeInUp delay-200 mb-8">
              <div className="glass-card rounded-xl p-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Check className="text-green-400" size={24} />
                    <span className="text-white font-medium">Your preferences are set!</span>
                  </div>
                  <button
                    onClick={onShowMatcher}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    Update
                  </button>
                </div>
                <div className="mt-3 text-slate-300 text-sm">
                  Properties are now ranked by your lifestyle match
                </div>
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="opacity-0 animate-fadeInUp delay-300 mb-16">
            <div className={`relative max-w-2xl mx-auto transition-all duration-300 ${searchFocused ? 'scale-105' : ''}`}>
              <input
                type="text"
                placeholder="Enter an address in Garden City, NY..."
                className="w-full px-6 py-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-slate-400 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <MapPin className="absolute right-6 top-1/2 transform -translate-y-1/2 text-slate-400" size={24} />
            </div>
            <p className="text-slate-400 text-sm mt-4">Try clicking a sample property below to explore</p>
          </div>

          {/* Sample Properties */}
          <div className="opacity-0 animate-fadeInUp delay-400">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-400 text-sm uppercase tracking-wider">
                {userPreferences ? 'Top Matches for You' : 'Sample Properties in Garden City'}
              </h3>
              {comparisonList.length > 0 && (
                <button className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2">
                  <Heart size={16} />
                  Compare ({comparisonList.length})
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {SAMPLE_PROPERTIES.sort((a, b) => userPreferences ? b.lifestyleMatch - a.lifestyleMatch : 0).map((property, idx) => (
                <div
                  key={property.id}
                  className={`glass-card rounded-xl p-6 text-left cursor-pointer opacity-0 animate-fadeIn relative`}
                  style={{ animationDelay: `${0.5 + idx * 0.1}s` }}
                >
                  {/* Match Badge */}
                  {userPreferences && (
                    <div className="absolute top-4 right-4 match-badge text-white px-3 py-1 rounded-full text-xs font-bold z-10">
                      {property.lifestyleMatch}% Match
                    </div>
                  )}

                  {/* Deal Breaker Warning - Moved to bottom left */}
                  {property.dealBreakers > 0 && userPreferences?.dealBreakers.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 z-10">
                      <AlertTriangle size={12} />
                      {property.dealBreakers}
                    </div>
                  )}

                  <div className="text-2xl font-bold text-white mb-2">{property.price}</div>
                  <div className="text-slate-300 text-sm mb-3">{property.address}</div>
                  <div className="flex gap-4 text-slate-400 text-sm mb-4">
                    <span>{property.beds} beds</span>
                    <span>•</span>
                    <span>{property.baths} baths</span>
                  </div>

                  {userPreferences && (
                    <div className="mb-4 pb-4 border-b border-slate-600">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Commute: {property.commuteTime} min</span>
                        <span>Walk Score: 85</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => onPropertySelect(property)}
                      className="flex-1 text-purple-400 text-sm font-medium flex items-center justify-center gap-2 hover:text-purple-300 transition-colors"
                    >
                      Explore <Navigation size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompare(property);
                      }}
                      className={`p-2 rounded transition-colors ${
                        comparisonList.find(p => p.id === property.id)
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <Heart size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-6xl mx-auto mt-24 grid md:grid-cols-4 gap-6 opacity-0 animate-fadeInUp delay-400">
          <FeatureCard
            icon={<Zap size={28} />}
            title="AI Matching"
            description="Get personalized property recommendations based on your lifestyle"
          />
          <FeatureCard
            icon={<Clock size={28} />}
            title="Commute Calculator"
            description="Real-time commute estimates from every property"
          />
          <FeatureCard
            icon={<AlertTriangle size={28} />}
            title="Deal-Breaker Alerts"
            description="Auto-flag properties with your specific concerns"
          />
          <FeatureCard
            icon={<TrendingUp size={28} />}
            title="Future Insights"
            description="Construction permits & developments coming to the area"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="glass-card rounded-xl p-8 text-center">
      <div className="text-purple-400 mb-4 flex justify-center">{icon}</div>
      <h3 className="text-white text-xl font-semibold mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function ExplorationView({ property, nearbyData, onBack }) {
  const [showStreetView, setShowStreetView] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const mapRef = useRef(null);
  const streetViewRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Smart Tour state
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourSpeed, setTourSpeed] = useState('normal'); // slow, normal, fast
  const [tourProgress, setTourProgress] = useState(0);
  const [currentPOI, setCurrentPOI] = useState(null);
  const streetViewInstanceRef = useRef(null);
  const tourIntervalRef = useRef(null);
  const tourStepRef = useRef(0);

  const handleContactSubmit = () => {
    // Log to console so you can see it working
    console.log('=== LEAD CAPTURED ===');
    console.log('Name:', formData.name);
    console.log('Email:', formData.email);
    console.log('Phone:', formData.phone);
    console.log('Message:', formData.message);
    console.log('Property:', property.address);
    console.log('======================');
    console.log('In production, this would email you the lead details.');
    
    // Close form and show success
    setShowContactForm(false);
    setShowSuccess(true);
    
    // Reset form
    setFormData({ name: '', email: '', phone: '', message: '' });
    
    // Hide success after 5 seconds
    setTimeout(() => setShowSuccess(false), 5000);
  };

  // Smart Tour: Calculate waypoints from property to POIs and back
  const calculateTourWaypoints = () => {
    if (!nearbyData) return [];
    
    const waypoints = [];
    const startPoint = { lat: property.coords.lat, lng: property.coords.lng, type: 'start', name: 'Property' };
    
    waypoints.push(startPoint);
    
    // Add schools (up to 2)
    if (nearbyData.schools && nearbyData.schools.length > 0) {
      nearbyData.schools.slice(0, 2).forEach(school => {
        if (school.distance < 1) { // Only nearby schools
          waypoints.push({
            lat: property.coords.lat + (Math.random() - 0.5) * 0.01,
            lng: property.coords.lng + (Math.random() - 0.5) * 0.01,
            type: 'school',
            name: school.name,
            distance: school.distance,
            walkTime: school.walkTime
          });
        }
      });
    }
    
    // Add transit (up to 1)
    if (nearbyData.transit && nearbyData.transit.length > 0) {
      const nearestTransit = nearbyData.transit[0];
      if (nearestTransit.distance < 1) {
        waypoints.push({
          lat: property.coords.lat + (Math.random() - 0.5) * 0.01,
          lng: property.coords.lng + (Math.random() - 0.5) * 0.01,
          type: 'transit',
          name: nearestTransit.name,
          distance: nearestTransit.distance,
          walkTime: nearestTransit.walkTime
        });
      }
    }
    
    // Add amenities (up to 2)
    if (nearbyData.amenities && nearbyData.amenities.length > 0) {
      nearbyData.amenities.slice(0, 2).forEach(amenity => {
        if (amenity.distance < 1) {
          waypoints.push({
            lat: property.coords.lat + (Math.random() - 0.5) * 0.01,
            lng: property.coords.lng + (Math.random() - 0.5) * 0.01,
            type: amenity.type.toLowerCase(),
            name: amenity.name,
            distance: amenity.distance
          });
        }
      });
    }
    
    // Return to start
    waypoints.push(startPoint);
    
    return waypoints;
  };

  // Calculate heading between two points
  const calculateHeading = (from, to) => {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const heading = Math.atan2(y, x) * 180 / Math.PI;
    
    return (heading + 360) % 360;
  };

  // Start Smart Tour
  const startTour = () => {
    if (!streetViewInstanceRef.current || !nearbyData) {
      console.log('Street View or nearby data not ready');
      return;
    }

    console.log('🚀 Starting Smart Tour...');
    
    const waypoints = calculateTourWaypoints();
    
    if (waypoints.length < 2) {
      console.log('Not enough waypoints for tour');
      return;
    }

    setIsTourActive(true);
    setTourPaused(false);
    setTourProgress(0);
    tourStepRef.current = 0;

    runTourStep(waypoints);
  };

  // Run tour step
  const runTourStep = (waypoints) => {
    if (!streetViewInstanceRef.current) return;

    const step = tourStepRef.current;
    
    if (step >= waypoints.length) {
      // Tour complete
      console.log('✅ Tour complete!');
      stopTour();
      return;
    }

    const currentWaypoint = waypoints[step];
    const nextWaypoint = waypoints[step + 1];

    console.log(`📍 Step ${step + 1}/${waypoints.length}: ${currentWaypoint.name}`);

    // Update current POI
    setCurrentPOI(currentWaypoint);
    setTourProgress(Math.round((step / waypoints.length) * 100));

    // Move to waypoint
    const heading = nextWaypoint ? calculateHeading(currentWaypoint, nextWaypoint) : 0;
    
    streetViewInstanceRef.current.setPosition(currentWaypoint);
    streetViewInstanceRef.current.setPov({
      heading: heading,
      pitch: 0
    });

    // Determine delay based on speed
    const delays = {
      slow: 4000,
      normal: 2500,
      fast: 1500
    };
    const delay = delays[tourSpeed] || 2500;

    // Schedule next step
    tourIntervalRef.current = setTimeout(() => {
      tourStepRef.current++;
      runTourStep(waypoints);
    }, delay);
  };

  // Pause tour
  const pauseTour = () => {
    setTourPaused(true);
    if (tourIntervalRef.current) {
      clearTimeout(tourIntervalRef.current);
    }
  };

  // Resume tour
  const resumeTour = () => {
    if (!streetViewInstanceRef.current || !nearbyData) return;
    
    setTourPaused(false);
    const waypoints = calculateTourWaypoints();
    runTourStep(waypoints);
  };

  // Stop tour
  const stopTour = () => {
    setIsTourActive(false);
    setTourPaused(false);
    setTourProgress(0);
    setCurrentPOI(null);
    tourStepRef.current = 0;
    
    if (tourIntervalRef.current) {
      clearTimeout(tourIntervalRef.current);
    }
  };

  // Cleanup tour on unmount
  useEffect(() => {
    return () => {
      if (tourIntervalRef.current) {
        clearTimeout(tourIntervalRef.current);
      }
    };
  }, []);

  // Check if Google Maps is loaded (from index.html script)
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
    } else {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          setMapLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      
      // Cleanup
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: property.coords.lat, lng: property.coords.lng },
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
    });

    // Property marker
    new window.google.maps.Marker({
      position: { lat: property.coords.lat, lng: property.coords.lng },
      map: map,
      title: property.address,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#EF4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    });

    // Nearby POI markers
    const pois = [
      { lat: property.coords.lat + 0.005, lng: property.coords.lng - 0.003, color: '#10B981', label: 'School' },
      { lat: property.coords.lat - 0.007, lng: property.coords.lng + 0.004, color: '#3B82F6', label: 'Train' },
      { lat: property.coords.lat + 0.003, lng: property.coords.lng + 0.005, color: '#F59E0B', label: 'Cafe' },
    ];

    pois.forEach(poi => {
      new window.google.maps.Marker({
        position: { lat: poi.lat, lng: poi.lng },
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: poi.color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
    });
  }, [mapLoaded, property]);

  // Initialize Street View
  useEffect(() => {
    if (!mapLoaded || !showStreetView || !streetViewRef.current) return;

    const panorama = new window.google.maps.StreetViewPanorama(
      streetViewRef.current,
      {
        position: { lat: property.coords.lat, lng: property.coords.lng },
        pov: { heading: 165, pitch: 0 },
        zoom: 1,
        // ENHANCED: Enable immersive exploration
        clickToGo: true,  // Click anywhere on the road to jump there
        linksControl: true,  // Show navigation arrows
        panControl: true,  // Enable pan controls
        zoomControl: true,  // Enable zoom
        addressControl: false,  // Hide address
        fullscreenControl: true,  // Allow fullscreen
        motionTracking: true,  // Smooth transitions
        motionTrackingControl: false,  // Hide motion tracking UI
        scrollwheel: true,  // Zoom with scroll wheel
        disableDoubleClickZoom: false,  // Allow double-click zoom
        showRoadLabels: true,  // Show street names
        // Keyboard navigation is enabled by default
      }
    );
    
    // Store panorama instance for Smart Tour
    streetViewInstanceRef.current = panorama;
    
    // Add keyboard navigation instructions
    console.log('🎮 Navigation Tips:');
    console.log('  • Click anywhere on the road to teleport');
    console.log('  • Arrow keys to look around');  
    console.log('  • +/- keys to zoom');
    console.log('  • Double-click to zoom in');
  }, [mapLoaded, showStreetView, property]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Back
              </button>
              <div>
                <h2 className="playfair text-2xl font-bold text-slate-900">{property.address}</h2>
                <p className="text-slate-600 text-sm">{property.price} • {property.beds} beds • {property.baths} baths</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowContactForm(true)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <Calendar size={16} />
                Schedule Viewing
              </button>
              <div className="ml-2">
                <NeighborScopeLogo size="sm" theme="light" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map View */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {!showStreetView ? (
                <>
                  <div 
                    ref={mapRef}
                    className="w-full h-[450px] bg-slate-200"
                  >
                    {!mapLoaded && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                          <p className="text-slate-600">Loading map...</p>
                          <p className="text-slate-500 text-sm mt-2">Garden City, NY</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Street View Toggle */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <button 
                      onClick={() => setShowStreetView(true)}
                      className="w-full py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={18} />
                      Explore Neighborhood (Street View)
                    </button>
                    <p className="text-xs text-slate-500 text-center mt-2">Click anywhere to walk around • Use arrow keys to look • Fullscreen available</p>
                  </div>
                </>
              ) : (
                <>
                  <div 
                    ref={streetViewRef}
                    className="w-full h-[450px] bg-slate-200 relative"
                  >
                    {!mapLoaded && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                          <p className="text-slate-600">Loading Street View...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Smart Tour Overlay */}
                  {isTourActive && currentPOI && (
                    <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 z-10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {currentPOI.type === 'school' && <School size={18} className="text-blue-500" />}
                            {currentPOI.type === 'transit' && <Train size={18} className="text-green-500" />}
                            {currentPOI.type === 'grocery' && <ShoppingBag size={18} className="text-orange-500" />}
                            {currentPOI.type === 'park' && <MapPin size={18} className="text-green-600" />}
                            {currentPOI.type === 'start' && <MapPin size={18} className="text-purple-600" />}
                            <h4 className="font-bold text-slate-900">{currentPOI.name}</h4>
                          </div>
                          {currentPOI.distance && (
                            <p className="text-sm text-slate-600">
                              {currentPOI.distance} mi away{currentPOI.walkTime && ` • ${currentPOI.walkTime} min walk`}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${tourProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1 text-center">{tourProgress}% complete</p>
                      </div>

                      {/* Tour Controls */}
                      <div className="flex items-center gap-2">
                        {!tourPaused ? (
                          <button
                            onClick={pauseTour}
                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <span>⏸</span> Pause
                          </button>
                        ) : (
                          <button
                            onClick={resumeTour}
                            className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <span>▶️</span> Resume
                          </button>
                        )}
                        <button
                          onClick={stopTour}
                          className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <span>⏹</span> Stop
                        </button>
                        
                        {/* Speed Control */}
                        <div className="flex gap-1">
                          {['slow', 'normal', 'fast'].map(speed => (
                            <button
                              key={speed}
                              onClick={() => setTourSpeed(speed)}
                              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                tourSpeed === speed
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {speed === 'slow' && '🐌'}
                              {speed === 'normal' && '⚡'}
                              {speed === 'fast' && '🚀'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Back to Map + Smart Tour Button */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                    {!isTourActive && nearbyData && (
                      <button 
                        onClick={startTour}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center justify-center gap-2"
                      >
                        <Eye size={18} />
                        Start Smart Tour
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        stopTour();
                        setShowStreetView(false);
                      }}
                      className="w-full py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <MapPin size={18} />
                      Back to Map View
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Info size={20} className="text-purple-500" />
                Quick Overview
              </h3>
              <div className="space-y-3">
                <StatRow label="Nearest School" value="0.3 mi (6 min walk)" />
                <StatRow label="Nearest Transit" value="0.6 mi (12 min walk)" />
                <StatRow label="Nearest Cafe" value="0.3 mi (6 min walk)" />
                <StatRow label="Grocery Store" value="0.8 mi" />
              </div>
            </div>

            {/* Schools */}
            {nearbyData && nearbyData.schools && nearbyData.schools.length > 0 ? (
              <CategoryCard
                title="Nearby Schools"
                icon={<School size={20} />}
                items={nearbyData.schools}
                renderItem={(school) => (
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-slate-900">{school.name}</div>
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                        {school.rating}/10
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">{school.type}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {school.distance} mi • {school.walkTime} min walk
                    </div>
                  </div>
                )}
              />
            ) : property.id === 'custom' ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <School size={20} />
                  Nearby Schools
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-amber-800 text-sm">
                    Unable to load nearby schools for this location. This may be due to limited data availability in this area.
                  </p>
                </div>
              </div>
            ) : (
              <CategoryCard
                title="Nearby Schools"
                icon={<School size={20} />}
                items={NEARBY_LOCATIONS.schools}
                renderItem={(school) => (
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-slate-900">{school.name}</div>
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                        {school.rating}/10
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">{school.type}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {school.distance} mi • {school.walkTime} min walk
                    </div>
                  </div>
                )}
              />
            )}

            {/* Transit */}
            {nearbyData && nearbyData.transit && nearbyData.transit.length > 0 ? (
              <CategoryCard
                title="Public Transit"
                icon={<Train size={20} />}
                items={nearbyData.transit}
                renderItem={(station) => (
                  <div>
                    <div className="font-medium text-slate-900">{station.name}</div>
                    <div className="text-sm text-slate-600">{station.line}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {station.distance} mi • {station.walkTime} min walk{station.toPennStation && ` • ${station.toPennStation} min to Penn Station`}
                    </div>
                  </div>
                )}
              />
            ) : property.id === 'custom' ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Train size={20} />
                  Public Transit
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-amber-800 text-sm">
                    Unable to load transit information for this location. This may be due to limited data availability in this area.
                  </p>
                </div>
              </div>
            ) : (
              <CategoryCard
                title="Public Transit"
                icon={<Train size={20} />}
                items={NEARBY_LOCATIONS.transit}
                renderItem={(station) => (
                  <div>
                    <div className="font-medium text-slate-900">{station.name}</div>
                    <div className="text-sm text-slate-600">{station.line}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {station.distance} mi • {station.walkTime} min walk • {station.toPennStation} min to Penn Station
                    </div>
                  </div>
                )}
              />
            )}

            {/* Concerns */}
            {PROPERTY_CONCERNS[property.id] && PROPERTY_CONCERNS[property.id].length > 0 ? (
              <CategoryCard
                title="Potential Concerns"
                icon={<AlertTriangle size={20} />}
                items={PROPERTY_CONCERNS[property.id]}
                renderItem={(concern) => (
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-slate-900">{concern.type}</div>
                      <div className={`px-2 py-1 rounded text-xs font-bold ${
                        concern.severity === 'high' ? 'bg-red-100 text-red-800' :
                        concern.severity === 'moderate' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {concern.severity}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">{concern.description}</div>
                    <div className="text-xs text-slate-500 mt-1">{concern.distance} mi away</div>
                  </div>
                )}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="text-green-500"><Check size={20} /></span>
                  Location Quality
                </h3>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Check className="text-green-600" size={24} />
                  <div>
                    <div className="font-medium text-green-900">No major concerns detected</div>
                    <div className="text-sm text-green-700 mt-1">This property has no significant location issues</div>
                  </div>
                </div>
              </div>
            )}

            {/* Amenities */}
            {nearbyData && nearbyData.amenities && nearbyData.amenities.length > 0 ? (
              <CategoryCard
                title="Amenities"
                icon={<ShoppingBag size={20} />}
                items={nearbyData.amenities}
                renderItem={(amenity) => (
                  <div>
                    <div className="font-medium text-slate-900">{amenity.name}</div>
                    <div className="text-sm text-slate-600">{amenity.type}</div>
                    <div className="text-xs text-slate-500 mt-1">{amenity.distance} mi</div>
                  </div>
                )}
              />
            ) : property.id === 'custom' ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <ShoppingBag size={20} />
                  Amenities
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-amber-800 text-sm">
                    Unable to load amenity information for this location. This may be due to limited data availability in this area.
                  </p>
                </div>
              </div>
            ) : (
              <CategoryCard
                title="Amenities"
                icon={<ShoppingBag size={20} />}
                items={NEARBY_LOCATIONS.amenities}
                renderItem={(amenity) => (
                  <div>
                    <div className="font-medium text-slate-900">{amenity.name}</div>
                    <div className="text-sm text-slate-600">{amenity.type}</div>
                    <div className="text-xs text-slate-500 mt-1">{amenity.distance} mi</div>
                  </div>
                )}
              />
            )}
          </div>
        </div>
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => setShowContactForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={24} />
            </button>
            
            <h3 className="playfair text-2xl font-bold text-slate-900 mb-2">Schedule a Viewing</h3>
            <p className="text-slate-600 mb-6">{property.address}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="John Smith"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="john@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message (Optional)</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  rows="3"
                  placeholder="Preferred viewing times, questions..."
                />
              </div>
              
              <button
                onClick={handleContactSubmit}
                disabled={!formData.name || !formData.email || !formData.phone}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send to Agent →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[101] w-full max-w-md px-4">
          <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <Check size={28} className="flex-shrink-0" />
            <div>
              <div className="font-bold text-lg">Request Received!</div>
              <div className="text-sm text-green-100">A local agent will contact you within 1 hour</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score }) {
  const getColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg p-3 text-center">
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${getColor(score)}`}>{score}</div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-600 text-sm">{label}</span>
      <span className="font-medium text-slate-900 text-sm">{value}</span>
    </div>
  );
}

function CategoryCard({ title, icon, items, renderItem }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span className="text-purple-500">{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonView({ properties, onBack, onRemove }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Back to Search
              </button>
              <h2 className="playfair text-2xl font-bold text-slate-900">Compare Properties</h2>
            </div>
            <NeighborScopeLogo size="sm" theme="light" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${properties.length}, minmax(0, 1fr))` }}>
          {properties.map(property => (
            <div key={property.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Property Header */}
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 text-white relative">
                <button
                  onClick={() => onRemove(property.id)}
                  className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="text-3xl font-bold mb-2">{property.price}</div>
                <div className="text-sm opacity-90 mb-3">{property.address}</div>
                <div className="flex gap-4 text-sm">
                  <span>{property.beds} beds</span>
                  <span>•</span>
                  <span>{property.baths} baths</span>
                </div>
              </div>

              {/* Comparison Metrics */}
              <div className="p-6 space-y-6">
                {/* Match Score */}
                <ComparisonMetric
                  label="Lifestyle Match"
                  value={`${property.lifestyleMatch}%`}
                  bar={property.lifestyleMatch}
                />

                {/* Commute */}
                <ComparisonMetric
                  label="Commute Time"
                  value={`${property.commuteTime} min`}
                  bar={100 - property.commuteTime}
                  inverted
                />

                {/* Walkability */}
                <ComparisonMetric
                  label="Walkability"
                  value="85/100"
                  bar={85}
                />

                {/* Schools */}
                <ComparisonMetric
                  label="School Quality"
                  value="9.2/10"
                  bar={92}
                />

                {/* Deal Breakers */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Concerns</span>
                    {property.dealBreakers === 0 ? (
                      <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800 flex items-center gap-1">
                        <Check size={12} />
                        No Issues
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        property.dealBreakers === 1 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {property.dealBreakers} {property.dealBreakers === 1 ? 'Issue' : 'Issues'}
                      </span>
                    )}
                  </div>
                  {property.dealBreakers > 0 && (
                    <div className="text-xs text-slate-600 space-y-1">
                      {PROPERTY_CONCERNS[property.id]?.map((concern, idx) => (
                        <div key={idx}>• {concern.type} ({concern.distance} mi)</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key Features */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-900">Nearby</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Schools</span>
                      <span className="font-medium">0.3 mi</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LIRR Station</span>
                      <span className="font-medium">0.6 mi</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coffee Shops</span>
                      <span className="font-medium">0.3 mi</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Grocery</span>
                      <span className="font-medium">0.8 mi</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button className="w-full btn-primary text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all">
                  View Full Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {properties.length < 3 && (
          <div className="mt-8 text-center">
            <button
              onClick={onBack}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              + Add Another Property to Compare
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonMetric({ label, value, bar, inverted = false }) {
  const getColor = (score) => {
    if (inverted) score = 100 - score;
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-900">{value}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getColor(bar)}`}
          style={{ width: `${bar}%` }}
        />
      </div>
    </div>
  );
                }
