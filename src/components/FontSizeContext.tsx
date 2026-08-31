import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type FontSizeContextType = {
  increase: () => void;
  decrease: () => void;
  reset: () => void;
};

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState(100); // 100% is standard 16px

  useEffect(() => {
    // Automatically scales all Tailwind rem-based classes across the app
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  const increase = () => setFontSize(prev => Math.min(prev + 15, 145)); // Max scale
  const decrease = () => setFontSize(prev => Math.max(prev - 15, 70));  // Min scale
  const reset = () => setFontSize(100);

  return (
    <FontSizeContext.Provider value={{ increase, decrease, reset }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) throw new Error('useFontSize must be used within FontSizeProvider');
  return context;
};