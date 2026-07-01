import React from 'react';

const SEEDS = [
  'Felix', 'Aneka', 'Jack', 'Mimi', 'Casper', 'Luna', 
  'Oliver', 'Willow', 'Leo', 'Maya', 'Toby', 'Zoe', 
  'Finn', 'Ruby', 'Arlo', 'Nala', 'Bear', 'Bella', 'Milo', 'Daisy'
];

export const AVATARS = SEEDS.map(seed => `https://api.dicebear.com/7.x/micah/svg?seed=${seed}&backgroundColor=transparent`);

interface AvatarPickerProps {
  value: string;
  onChange: (avatar: string) => void;
}

export default function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  // Ensure the value being passed is within our generated avatars, otherwise default to the first one
  const safeValue = AVATARS.includes(value) ? value : AVATARS[0];

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
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">Elegir Avatar</h3>
        <div className="flex flex-wrap justify-center gap-2 max-h-[220px] overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-gray-100 dark:border-slate-700/50">
          {AVATARS.map((avatar, i) => (
            <button
              key={i}
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
