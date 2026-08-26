import React from 'react';

type StatusType = 'pending' | 'approved' | 'rejected' | 'pending_mentor' | 'pending_hod';

interface StatusBadgeProps {
  status: StatusType;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    pending: {
      bg: 'bg-neuyellow text-[#000000] border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[2px_2px_0px_rgba(255,255,255,1)] dark:text-black',
      dot: 'bg-black',
      label: 'Pending Review',
    },
    pending_mentor: {
      bg: 'bg-neublue text-[#000000] border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[2px_2px_0px_rgba(255,255,255,1)] dark:text-black',
      dot: 'bg-black',
      label: 'Awaiting Mentor',
    },
    pending_hod: {
      bg: 'bg-neublue text-[#000000] border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[2px_2px_0px_rgba(255,255,255,1)] dark:text-black',
      dot: 'bg-black',
      label: 'Awaiting HOD',
    },
    approved: {
      bg: 'bg-neugreen text-[#000000] border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[2px_2px_0px_rgba(255,255,255,1)] dark:text-black',
      dot: 'bg-black',
      label: 'Approved & Signed',
    },
    rejected: {
      bg: 'bg-neured text-[#000000] border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[2px_2px_0px_rgba(255,255,255,1)] dark:text-black line-through decoration-1',
      dot: 'bg-black',
      label: 'Rejected',
    },
  };

  const current = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold rounded-xl ${current.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}
