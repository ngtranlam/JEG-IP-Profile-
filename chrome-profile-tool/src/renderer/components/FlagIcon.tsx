import React from 'react';
import * as flags from 'country-flag-icons/react/3x2';

interface FlagIconProps {
  countryCode: string;
  className?: string;
  title?: string;
}

export const FlagIcon: React.FC<FlagIconProps> = ({ countryCode, className = 'w-5 h-4', title }) => {
  if (!countryCode || countryCode.length !== 2) {
    return <span className={className} title={title || 'Unknown'}>🌐</span>;
  }

  const code = countryCode.toUpperCase();
  const FlagComponent = (flags as any)[code];

  if (!FlagComponent) {
    return <span className={className} title={title || code}>🌐</span>;
  }

  return (
    <FlagComponent 
      className={className}
      title={title || code}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
};
