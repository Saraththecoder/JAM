'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Zap } from 'lucide-react';

export default function AnimatedHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);

  const renderLetters = (text: string) => {
    return text.split('').map((char, index) => {
      if (char === ' ') {
        return <span key={index} className="inline-block">&nbsp;</span>;
      }
      return (
        <span key={index} className="animate-letter inline-block transform origin-bottom opacity-0">
          {char}
        </span>
      );
    });
  };

  useGSAP(() => {
    const runAnimation = () => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

      // 1. Badge slide in & rotate slightly
      tl.fromTo(badgeRef.current,
        { y: -30, opacity: 0, scale: 0.8, rotate: -3 },
        { y: 0, opacity: 1, scale: 1, rotate: 0, duration: 0.6 }
      );

      // 2. Title letter-by-letter springy slide up
      const letters = titleRef.current?.querySelectorAll('.animate-letter');
      if (letters && letters.length > 0) {
        tl.fromTo(letters,
          { y: 40, opacity: 0, rotate: 10 },
          { y: 0, opacity: 1, rotate: 0, duration: 0.6, stagger: 0.03, ease: 'back.out(1.6)' },
          '-=0.3'
        );
      }

      // 3. Digital Approval block pop and bounce entrance
      const approvalBlock = titleRef.current?.querySelector('.animate-approval-block');
      if (approvalBlock) {
        tl.fromTo(approvalBlock,
          { scale: 0.4, opacity: 0, rotate: -4 },
          { scale: 1, opacity: 1, rotate: 0, duration: 0.85, ease: 'back.out(1.8)' },
          '-=0.4'
        );
      }

      // 4. Description fade & slide in
      tl.fromTo(descRef.current,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65 },
        '-=0.5'
      );
    };

    if (typeof window !== 'undefined') {
      if ((window as any).__splashScreenComplete) {
        runAnimation();
      } else {
        window.addEventListener('splashScreenComplete', runAnimation);
        return () => window.removeEventListener('splashScreenComplete', runAnimation);
      }
    } else {
      runAnimation();
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="flex flex-col space-y-5 sm:space-y-6">
      {/* Badge */}
      <div 
        ref={badgeRef} 
        style={{ opacity: 0 }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold border-2 border-black bg-neublue text-black rounded-lg w-fit shadow-[2px_2px_0px_rgba(0,0,0,1)]"
      >
        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
        Department Letter Automation
      </div>

      {/* Animated Title */}
      <h1 
        ref={titleRef}
        className="text-2xl min-[360px]:text-3xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight leading-[1.1] text-zinc-900"
      >
        <span className="block overflow-hidden py-1">
          <span className="block">
            {renderLetters("Instant Letters.")}
          </span>
        </span>
        <span className="block overflow-hidden py-1">
          <span className="animate-approval-block bg-black text-neuyellow px-3 py-1.5 inline-block border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.15)] rounded-lg mt-1 min-[360px]:mt-0 opacity-0 transform origin-center">
            Digital Approval.
          </span>
        </span>
      </h1>

      {/* Description */}
      <p 
        ref={descRef}
        style={{ opacity: 0 }}
        className="text-zinc-650 text-xs sm:text-base md:text-lg font-medium leading-relaxed max-w-xl"
      >
        No paper routing. No long waits outside HOD cabins. Draft leave, permission, and booking requests instantly. Faculty approve and sign with a single click.
      </p>
    </div>
  );
}
