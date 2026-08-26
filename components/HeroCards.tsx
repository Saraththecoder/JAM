'use client';

import React, { useState, useRef } from 'react';
import { Calendar, Check, RefreshCw } from 'lucide-react';

interface PreviewLetter {
  ref: string;
  date: string;
  subject: string;
  body: string;
  studentName: string;
  rollNo: string;
  mentorSigned: boolean;
  hodApproved: boolean;
  type: string;
}

const PREVIEW_LETTERS: PreviewLetter[] = [
  {
    type: 'Leave Request',
    ref: 'AITS/AIML/2026/L390A',
    date: '25-Aug-2026',
    subject: 'Request for Leave Letter - Reg.',
    body: 'Respected Sir,\nI, Student Name (24AK1A33D8), request leave for today due to stomach pain. I will make up for the missed classes.',
    studentName: 'Rahul Reddy',
    rollNo: '24AK1A33D8',
    mentorSigned: true,
    hodApproved: true,
  },
  {
    type: 'Outing Pass',
    ref: 'AITS/AIML/2026/O184D',
    date: '26-Aug-2026',
    subject: 'Request for Outing Pass - Reg.',
    body: 'Respected Madam,\nI request permission to leave campus on 26-Aug-2026 from 2:00 PM to 6:00 PM to attend a medical appointment at the local clinic.',
    studentName: 'Sneha Paul',
    rollNo: '24AK1A34J2',
    mentorSigned: true,
    hodApproved: true,
  },
  {
    type: 'Event Conduct',
    ref: 'AITS/AIML/2026/E904K',
    date: '27-Aug-2026',
    subject: 'Permission for Technical Seminar - Reg.',
    body: 'Respected Sir,\nWe request permission to conduct a technical seminar on "Applications of LLMs" in Seminar Hall 2 on 30-Aug-25 from 10:00 AM.',
    studentName: 'AI Club Coordinator',
    rollNo: '24AK1A33E5',
    mentorSigned: true,
    hodApproved: true,
  }
];

export default function HeroCards() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % PREVIEW_LETTERS.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + PREVIEW_LETTERS.length) % PREVIEW_LETTERS.length);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    isDragging.current = true;
    setIsSwiping(false);
    // Capture pointer to track dragging outside boundaries
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - startX.current;
    
    // Check if dragging is meaningful (above threshold)
    if (Math.abs(deltaX) > 5) {
      setIsSwiping(true);
      setDragOffset(deltaX);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Threshold for swipe trigger (80px)
    if (dragOffset < -80) {
      handleNext();
    } else if (dragOffset > 80) {
      handlePrev();
    }

    setDragOffset(0);
    setIsSwiping(false);
  };

  const getOffsetStyles = (idx: number) => {
    // Relative position in stack based on activeIndex
    const position = (idx - activeIndex + PREVIEW_LETTERS.length) % PREVIEW_LETTERS.length;
    
    if (position === 0) {
      // Top card follows drag offset and rotates slightly
      const rotateDeg = dragOffset * 0.05;
      return {
        zIndex: 30,
        transform: `translate(${dragOffset}px, 0px) rotate(${rotateDeg}deg) scale(1)`,
        opacity: 1,
        pointerEvents: 'auto' as const,
        // Disable transitions when dragging, but enable when resetting/switching
        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out',
      };
    } else if (position === 1) {
      // Middle card scales up slightly as top card is dragged away
      const dragPercent = Math.min(Math.abs(dragOffset) / 150, 1);
      const translateX = 8 - dragPercent * 8;
      const translateY = 8 - dragPercent * 8;
      const scale = 0.98 + dragPercent * 0.02;
      return {
        zIndex: 20,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        opacity: 0.95 + dragPercent * 0.05,
        pointerEvents: 'none' as const,
        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out',
      };
    } else {
      // Bottom card scales up slightly as top card is dragged away
      const dragPercent = Math.min(Math.abs(dragOffset) / 150, 1);
      const translateX = 16 - dragPercent * 8;
      const translateY = 16 - dragPercent * 8;
      const scale = 0.96 + dragPercent * 0.02;
      return {
        zIndex: 10,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        opacity: 0.85 + dragPercent * 0.1,
        pointerEvents: 'none' as const,
        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out',
      };
    }
  };

  const getBorderColor = (idx: number) => {
    const position = (idx - activeIndex + PREVIEW_LETTERS.length) % PREVIEW_LETTERS.length;
    if (position === 0) return 'border-black';
    if (position === 1) return 'border-black/60';
    return 'border-black/35';
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[320px] min-[375px]:max-w-[350px] min-[425px]:max-w-sm mx-auto">
      {/* Cards Stack Wrapper */}
      <div 
        className="relative w-full h-[280px] sm:h-[300px] cursor-grab active:cursor-grabbing group select-none touch-none"
      >
        {PREVIEW_LETTERS.map((letter, idx) => {
          const styles = getOffsetStyles(idx);
          const isTop = styles.zIndex === 30;

          return (
            <div
              key={idx}
              style={styles}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
              className={`absolute top-0 left-0 w-full p-4 sm:p-5 paper-card rounded-2xl bg-white transition-all border-2 ${getBorderColor(idx)} ${
                isTop ? 'shadow-[4px_4px_0px_rgba(0,0,0,1)]' : 'shadow-none'
              } group-hover:${isTop && !isSwiping ? 'translate-y-[-2px] translate-x-[-2px] shadow-[6px_6px_0px_rgba(0,0,0,1)]' : ''}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-2 border-b-2 border-dashed border-black/15 font-sans">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 border border-black animate-pulse" />
                  <span className="text-[8px] sm:text-[9px] font-extrabold text-emerald-600 tracking-wider uppercase">
                    {letter.type}
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] font-mono font-bold text-zinc-400">
                  {letter.ref}
                </span>
              </div>

              {/* Card Body */}
              <div className="space-y-3 pt-3 text-[9px] sm:text-[10px] font-sans text-zinc-700 font-medium">
                <p className="text-right font-mono font-bold text-zinc-450">Date: {letter.date}</p>
                <div className="space-y-0.5">
                  <p className="font-bold">To,</p>
                  <p>The Head of the Department,</p>
                  <p>Artificial Intelligence &amp; Machine Learning.</p>
                </div>
                <div className="space-y-1 pt-1">
                  <p className="font-bold underline text-black">{letter.subject}</p>
                  <p className="leading-relaxed italic text-black/90 line-clamp-3">
                    {letter.body}
                  </p>
                </div>

                {/* Signatures Footer */}
                <div className="flex justify-between items-end pt-3 border-t border-black/10">
                  <div>
                    <p className="font-bold text-[8px] text-zinc-400">Submitted by:</p>
                    <p className="font-extrabold text-black leading-tight">{letter.studentName}</p>
                    <p className="text-[8px] font-mono font-bold text-zinc-500">({letter.rollNo})</p>
                  </div>
                  
                  <div className="flex gap-1.5 shrink-0">
                    <div className="text-center">
                      <span className="text-[7px] font-bold px-1 bg-neublue text-black rounded border border-black block mb-0.5">Mentor</span>
                      <div className="px-1 py-0.5 border border-dashed border-black rounded flex items-center gap-0.5 text-[7px] text-emerald-600 font-black bg-neugreen/10">
                        <Check className="w-2 h-2 stroke-[3]" /> Rec
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-[7px] font-bold px-1 bg-neuyellow text-black rounded border border-black block mb-0.5">HOD</span>
                      <div className="px-1 py-0.5 border border-dashed border-black rounded flex items-center gap-0.5 text-[7px] text-emerald-600 font-black bg-neugreen/10">
                        <Check className="w-2 h-2 stroke-[3]" /> App
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs / Indicators */}
      <div className="flex gap-2 items-center">
        {PREVIEW_LETTERS.map((letter, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`px-3 py-1 text-[9px] font-black rounded-lg border-2 border-black transition-all shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] hover:translate-x-[-0.5px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none cursor-pointer ${
                isActive 
                  ? 'bg-neuyellow text-black' 
                  : 'bg-white text-zinc-500 hover:text-black'
              }`}
            >
              {letter.type.split(' ')[0]}
            </button>
          );
        })}
        <button
          onClick={handleNext}
          title="Cycle Letters"
          className="p-1 rounded-lg border-2 border-black bg-white hover:bg-zinc-50 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] hover:translate-x-[-0.5px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-black" />
        </button>
      </div>
    </div>
  );
}
