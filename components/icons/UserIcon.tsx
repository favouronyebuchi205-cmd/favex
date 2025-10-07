import React from 'react';

interface UserIconProps {
  avatar?: string | null;
}

export const UserIcon: React.FC<UserIconProps> = ({ avatar }) => {
  if (avatar) {
    return (
      <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
};
