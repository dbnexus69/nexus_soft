import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Avatar({ src, name, size = 'sm', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-full border border-gray-200 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
