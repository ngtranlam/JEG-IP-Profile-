import React from 'react';
import loadingGif from '../assets/loading-chicken.gif';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-32 h-32',
    md: 'w-64 h-64',
    lg: 'w-96 h-96'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <img
        src={loadingGif}
        alt="Loading..."
        className={`${sizeClasses[size]} object-contain`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};
