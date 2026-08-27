'use client';

import React, { useRef, useState } from 'react';
import Logo from './Logo';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export default function SplashScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useGSAP(() => {
    if (!containerRef.current) return;

    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false); // remove from DOM
        if (typeof window !== 'undefined') {
          (window as any).__splashScreenComplete = true;
          window.dispatchEvent(new CustomEvent('splashScreenComplete'));
        }
      }
    });

    // 1. Entrance of logo (pop in) and title
    tl.fromTo(logoRef.current,
      { scale: 0, rotation: -45, opacity: 0 },
      { scale: 1.2, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }
    );
    
    tl.to(logoRef.current, {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out'
    });

    tl.fromTo(titleRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' },
      '-=0.2'
    );

    tl.fromTo(subtitleRef.current,
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' },
      '-=0.3'
    );

    // Neubrutalist progress bar animation
    tl.fromTo(progressRef.current,
      { width: '0%' },
      { width: '100%', duration: 1.0, ease: 'power1.inOut' },
      '-=0.4'
    );

    // 2. Premium Neubrutalist slide up exit transition
    tl.to(containerRef.current, {
      yPercent: -100,
      duration: 0.65,
      ease: 'power4.inOut',
      delay: 0.1
    });

  }, { scope: containerRef });

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-[#eae7dc] flex flex-col items-center justify-center px-6 overflow-hidden select-none"
    >
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      {/* Main Content Area */}
      <div className="relative flex flex-col items-center text-center z-10">
        {/* Animated Logo Container */}
        <div ref={logoRef} style={{ opacity: 0 }} className="mb-6">
          <Logo size="lg" className="w-24 h-24 sm:w-28 sm:h-28 shadow-[4px_4px_0px_rgba(0,0,0,1)] border-2 border-black rounded-2xl" />
        </div>

        {/* Brand Text */}
        <h1
          ref={titleRef}
          style={{ opacity: 0 }}
          className="text-4xl sm:text-5xl font-serif font-black text-black tracking-tight"
        >
          JAM
        </h1>

        <p
          ref={subtitleRef}
          style={{ opacity: 0 }}
          className="text-[10px] sm:text-xs font-mono font-extrabold text-zinc-600 mt-2 uppercase tracking-widest"
        >
          Just A Minute • Letter Automation
        </p>

        {/* Neubrutalist Loader Track */}
        <div className="w-48 sm:w-56 h-3 bg-white border-2 border-black rounded-full overflow-hidden mt-8 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <div
            ref={progressRef}
            className="h-full bg-neuyellow border-r-2 border-black"
            style={{ width: '0%' }}
          />
        </div>
      </div>
    </div>
  );
}
