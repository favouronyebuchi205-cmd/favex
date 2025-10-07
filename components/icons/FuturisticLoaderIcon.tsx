import React from 'react';

export const FuturisticLoaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-blue-500 dark:text-blue-400"
  >
    <g>
      <circle cx="12" cy="12" r="10">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="10;8;10"
          dur="4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="12" cy="12" r="6">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 12 12"
          to="0 12 12"
          dur="3s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="6;8;6"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="12" cy="12" r="2">
        <animate
          attributeName="r"
          values="2;4;2"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  </svg>
);