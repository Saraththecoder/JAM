import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <svg 
      className={`${sizeClasses[size]} ${className} select-none`} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Neubrutalist Shadow Box Offset */}
      <rect x="16" y="16" width="70" height="70" rx="14" fill="black" />
      
      {/* Front Canvas Card */}
      <rect 
        x="10" 
        y="10" 
        width="70" 
        height="70" 
        rx="14" 
        fill="#ebd28e" /* neuyellow theme */
        stroke="black" 
        strokeWidth="4" 
      />
      
      {/* Hand-drawn signature loop */}
      <path 
        d="M25 48 C 30 28, 42 28, 48 48 C 54 68, 62 68, 67 48" 
        stroke="black" 
        strokeWidth="5" 
        strokeLinecap="round" 
        fill="none" 
      />
      
      {/* Decorative Signature Nib Dot */}
      <circle 
        cx="67" 
        cy="48" 
        r="5.5" 
        fill="#eb8980" /* neured theme */
        stroke="black" 
        strokeWidth="2.5" 
      />
      
      {/* Small document lines decoration */}
      <line x1="22" y1="22" x2="42" y2="22" stroke="black" strokeWidth="3" strokeLinecap="round" />
      <line x1="22" y1="29" x2="32" y2="29" stroke="black" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
