import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BackNavigationProps {
  to: string;
  label: string;
}

const BackNavigation: React.FC<BackNavigationProps> = ({ to, label }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to {label}
    </button>
  );
};

export default BackNavigation;
