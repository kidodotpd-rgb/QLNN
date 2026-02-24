
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = "", size = 40 }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="12" fill="#003366"/>
        <path d="M20 10L10 15L20 20L30 15L20 10Z" fill="white"/>
        <path d="M10 15V25L20 30V20L10 15Z" fill="#10B981"/>
        <path d="M30 15V25L20 30V20L30 15Z" fill="#059669"/>
        <circle cx="20" cy="18" r="3" fill="#FCD34D"/>
        <path d="M18 22H22V26H18V22Z" fill="white" opacity="0.8"/>
      </svg>
    </div>
  );
};

export default Logo;
