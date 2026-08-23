import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

export const generateAvatarUrl = (seed: string) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=transparent`;

const INITIAL_SEEDS = [
  'Felix', 'Aneka', 'Jack', 'Mimi', 'Casper', 'Luna', 
  'Oliver', 'Willow', 'Leo', 'Maya', 'Toby', 'Zoe', 
  'Finn', 'Ruby', 'Arlo', 'Nala', 'Bear', 'Bella', 'Milo', 'Daisy'
];

export const AVATARS = INITIAL_SEEDS.map(generateAvatarUrl);

interface AvatarPickerProps {
  value: string;
  onChange: (avatar: string) => void;
}

export default function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const [avatarsList, setAvatarsList] = useState<string[]>(AVATARS);
  
  // Ensure the value being passed is handled properly.
  // If it's empty, we default to the first one in the list.
  const safeValue = value || avatarsList[0];

  const handleGenerateMore = () => {
    const newAvatars = Array.from({ length: 20 }).map(() => {
      const randomSeed = Math.random().toString(36).substring(2, 10);
      return generateAvatarUrl(randomSeed);
    });
    setAvatarsList(newAvatars);
  };

  // If the currently selected avatar isn't in the list (because we generated new ones),
  // we prepend it so it remains visible.
  const displayAvatars = useMemo(() => {
    if (safeValue && !avatarsList.includes(safeValue)) {
      return [safeValue, ...avatarsList.slice(0, 19)];
    }
    return avatarsList;
  }, [avatarsList, safeValue]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-full blur-xl animate-pulse"></div>
        <div className="relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-4 border-white dark:border-slate-700 shadow-xl rounded-full p-2 transition-transform duration-300 hover:scale-105">
          <img 
            src={safeValue} 
            alt="Selected Avatar" 
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover"
          />
        </div>
      </div>
      
      <div className="w-full">
        <div className="flex justify-between items-center mb-3 px-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Elegir Avatar</h3>
          <button 
            type="button" 
            onClick={handleGenerateMore}
            className="text-xs flex items-center gap-1.5 text-primary hover:text-primary/80 font-bold transition-all hover:scale-105 bg-primary/10 px-2.5 py-1 rounded-md"
          >
            <RefreshCw size={14} /> Nuevos
          </button>
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 max-h-[220px] overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-gray-100 dark:border-slate-700/50">
          {displayAvatars.map((avatar, i) => (
            <button
              key={`${avatar}-${i}`}
              type="button"
              onClick={() => onChange(avatar)}
              className={`w-12 h-12 rounded-full cursor-pointer border-2 transition-all hover:scale-110 flex items-center justify-center p-0.5 overflow-hidden ${
                safeValue === avatar 
                  ? 'border-primary ring-2 ring-primary/30 scale-110 bg-primary/5 shadow-md z-10' 
                  : 'border-transparent opacity-60 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <img src={avatar} alt={`Avatar ${i+1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
