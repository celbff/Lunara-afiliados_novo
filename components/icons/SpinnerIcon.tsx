
import React from 'react';

export const SpinnerIcon: React.FC = () => (
  <div
    className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"
    role="status"
    aria-label="Loading"
  ></div>
);
