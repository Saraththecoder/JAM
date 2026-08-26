'use client';

import React, { forwardRef } from 'react';
import Link from 'next/link';
import { LogOut, Plus, ArrowLeft } from 'lucide-react';
import Logo from './Logo';

interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  role?: 'student' | 'faculty' | 'review' | 'wizard';
  profile?: {
    full_name: string;
    designation?: string;
    roll_number?: string;
    departments?: {
      name: string;
    };
  } | null;
  onLogout?: () => void;
  // Wizard / Review back actions
  backHref?: string;
  backText?: string;
  backAction?: () => void;
  stepText?: string;
  statusBadge?: React.ReactNode;
}

const Navbar = forwardRef<HTMLElement, NavbarProps>(({
  role = 'student',
  profile,
  onLogout,
  backHref,
  backText = 'Back',
  backAction,
  stepText,
  statusBadge,
  className = '',
  ...props
}, ref) => {

  const getPortalBadge = () => {
    switch (role) {
      case 'student':
        return (
          <span className="hidden min-[380px]:inline-block ml-2 text-[9px] font-mono font-black bg-neublue text-black border-2 border-black px-2 py-0.5 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] uppercase tracking-wider animate-pulse animate-duration-3000">
            STUDENT
          </span>
        );
      case 'faculty':
        return (
          <span className="hidden min-[380px]:inline-block ml-2 text-[9px] font-mono font-black bg-neuyellow text-black border-2 border-black px-2 py-0.5 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] uppercase tracking-wider">
            FACULTY DECK
          </span>
        );
      case 'wizard':
        return (
          <span className="hidden min-[380px]:inline-block ml-2 text-[9px] font-mono font-black bg-neugreen text-black border-2 border-black px-2 py-0.5 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] uppercase tracking-wider">
            WIZARD
          </span>
        );
      case 'review':
        return (
          <span className="hidden min-[380px]:inline-block ml-2 text-[9px] font-mono font-black bg-neured text-black border-2 border-black px-2 py-0.5 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] uppercase tracking-wider">
            REVIEW UNIT
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <nav
      ref={ref}
      className={`sticky top-4 z-40 mx-4 sm:mx-6 my-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 duration-200 ${className}`}
      aria-label="Navigation Header"
      {...props}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Left Side: Brand Logo / Back Buttons */}
        <div className="flex items-center gap-3">
          {/* Back button logic if in wizard or review sub-pages */}
          {backAction || backHref ? (
            <div className="flex items-center gap-3">
              {backAction ? (
                <button
                  onClick={backAction}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-black bg-[#ebd28e] text-black font-extrabold text-xs rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
                  aria-label={backText}
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{backText}</span>
                </button>
              ) : (
                <Link
                  href={backHref || '/'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-black bg-[#ebd28e] text-black font-extrabold text-xs rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                  aria-label={backText}
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{backText}</span>
                </Link>
              )}
              
              <div className="h-6 w-0.5 bg-black/20" />
            </div>
          ) : null}

          {/* Logo & Text Brand */}
          <Link href="/" className="flex items-center gap-2 group" aria-label="JAM Home">
            <Logo size="sm" className="transition-transform group-hover:rotate-12 group-hover:scale-110 duration-200" />
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="font-serif font-black text-base sm:text-lg tracking-tight text-black">
                JAM
              </span>
              {getPortalBadge()}
            </div>
          </Link>
        </div>

        {/* Center Section: Wizard Steps or Status Badges */}
        {stepText && (
          <div className="hidden md:block">
            <span className="text-xs font-black px-3 py-1 bg-neublue text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              {stepText}
            </span>
          </div>
        )}
        {statusBadge && (
          <div className="hidden min-[380px]:block">
            {statusBadge}
          </div>
        )}

        {/* Right Side: Profile & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Student Portal: "New Letter" Button */}
          {role === 'student' && (
            <Link
              href="/student/new-letter"
              className="paper-btn inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold"
              aria-label="Create new letter request"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">New Request</span>
              <span className="sm:hidden">New</span>
            </Link>
          )}

          {/* Profile Card Info (Pill Design) */}
          {profile && (
            <div className="flex items-center gap-2 px-2.5 py-1 sm:py-1.5 bg-[#fbfaf7] border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <div className="w-6 h-6 rounded-full bg-neugreen text-black border-2 border-black flex items-center justify-center text-[10px] font-black shrink-0 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                {profile.full_name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block max-w-[120px] md:max-w-[160px]">
                <p className="text-xs font-black text-black truncate leading-tight">
                  {profile.full_name.split(' ')[0]}
                  {profile.full_name.split(' ')[1] ? ` ${profile.full_name.split(' ')[1]}` : ''}
                </p>
                <p className="text-[8px] font-mono text-zinc-550 font-bold truncate leading-none">
                  {profile.designation || profile.roll_number || 'Member'}
                </p>
              </div>
            </div>
          )}

          {/* Wizard step indicator for mobile */}
          {stepText && (
            <span className="md:hidden text-[10px] font-black px-2 py-0.5 bg-neublue text-black rounded border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]">
              {stepText.replace('Step', 'S')}
            </span>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-black hover:text-white rounded-xl transition-all border-2 border-black bg-neured hover:bg-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] cursor-pointer shrink-0"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
