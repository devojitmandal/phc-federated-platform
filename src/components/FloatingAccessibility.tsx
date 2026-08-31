import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFontSize } from '@/components/FontSizeContext';
import { Globe, MapPin, Loader2 } from 'lucide-react';

export default function FloatingAccessibility() {
  const location = useLocation();
  const { increase, decrease, reset } = useFontSize();
  const { i18n, t } = useTranslation();
  
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  if (location.pathname === '/') return null;

  // Language mapping based on detected Indian states
  const handleSmartLocationDetect = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    setLocationMessage("Detecting region...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Free public reverse geocoding API to find state/country without paid keys
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          
          const state = data.address?.state || "";
          const country = data.address?.country || "";

          console.log("Detected State:", state);

          // Smart auto-selection logic based on region
          if (state.toLowerCase().includes("west bengal")) {
            i18n.changeLanguage('bn');
            setLocationMessage("📍 West Bengal detected: Switched to Bengali (बंगाली)");
          } else if (state.toLowerCase().includes("maharashtra")) {
            i18n.changeLanguage('mr');
            setLocationMessage("📍 Maharashtra detected: Switched to Marathi");
          } else if (state.toLowerCase().includes("tamil nadu")) {
            i18n.changeLanguage('ta');
            setLocationMessage("📍 Tamil Nadu detected: Switched to Tamil");
          } else if (state.toLowerCase().includes("telangana") || state.toLowerCase().includes("andhra pradesh")) {
            i18n.changeLanguage('te');
            setLocationMessage("📍 Telugu region detected: Switched to Telugu");
          } else if (country === "India") {
            i18n.changeLanguage('hi');
            setLocationMessage("📍 India detected: Switched to Hindi default");
          } else {
            setLocationMessage("📍 Location found, language left unchanged.");
          }
        } catch (err) {
          console.error("Geo error:", err);
          setLocationMessage("Could not resolve region.");
        } finally {
          setIsDetecting(false);
          // Clear notification message after 5 seconds
          setTimeout(() => setLocationMessage(null), 5000);
        }
      },
      (error) => {
        console.error(error);
        setIsDetecting(false);
        setLocationMessage("Location access denied.");
        setTimeout(() => setLocationMessage(null), 4000);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200/60 bg-white/80 px-4 py-1.5 shadow-lg backdrop-blur-md dark:border-gray-700/60 dark:bg-gray-900/80">
      
      {/* Font Size Controls */}
      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 dark:border-gray-700">
        <span className="mr-1 text-xs font-bold uppercase tracking-wide text-gray-500">
          {t('Text:')}
        </span>
        <button onClick={decrease} className="rounded px-2 py-0.5 text-xs font-bold text-gray-700 transition hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">A-</button>
        <button onClick={reset} className="rounded px-2 py-0.5 text-xs font-bold text-gray-700 transition hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">A</button>
        <button onClick={increase} className="rounded px-2 py-0.5 text-xs font-bold text-gray-700 transition hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">A+</button>
      </div>

      {/* Language Selector Dropdown */}
      <div className="flex items-center gap-1.5 border-r border-gray-200 pr-2 dark:border-gray-700">
        <Globe className="h-4 w-4 text-gray-500" />
        <select 
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="bg-transparent text-xs font-medium text-gray-700 focus:outline-none dark:text-gray-300 cursor-pointer"
        >
          <option value="en" className="dark:bg-gray-900">English</option>
          <option value="hi" className="dark:bg-gray-900">हिंदी (Hindi)</option>
          <option value="bn" className="dark:bg-gray-900">বাংলা (Bengali)</option>
          <option value="te" className="dark:bg-gray-900">తెలుగు (Telugu)</option>
          <option value="ta" className="dark:bg-gray-900">தமிழ் (Tamil)</option>
          <option value="mr" className="dark:bg-gray-900">मराठी (Marathi)</option>
        </select>
      </div>

      {/* Smart Location Auto-Detect Button */}
      <div className="relative flex items-center">
        <button
          onClick={handleSmartLocationDetect}
          disabled={isDetecting}
          title="Auto-detect local language based on GPS"
          className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/50"
        >
          {isDetecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
          <span>Auto-Region</span>
        </button>

        {/* Floating Notification Toast */}
        {locationMessage && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-3 py-1 text-[11px] font-medium text-white shadow-xl dark:bg-gray-100 dark:text-gray-900 z-50">
            {locationMessage}
          </div>
        )}
      </div>

    </div>
  );
}