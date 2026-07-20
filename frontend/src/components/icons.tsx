import React from 'react';

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 20 20',
  fill: 'none' as const,
  xmlns: 'http://www.w3.org/2000/svg',
  shapeRendering: 'crispEdges' as const,
};

export const IconQr: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="2" y="2" width="6" height="6" fill="currentColor" />
    <rect x="4" y="4" width="2" height="2" fill="black" fillOpacity="0.4" />
    <rect x="12" y="2" width="6" height="6" fill="currentColor" />
    <rect x="14" y="4" width="2" height="2" fill="black" fillOpacity="0.4" />
    <rect x="2" y="12" width="6" height="6" fill="currentColor" />
    <rect x="4" y="14" width="2" height="2" fill="black" fillOpacity="0.4" />
    <rect x="10" y="2" width="2" height="2" fill="currentColor" />
    <rect x="10" y="10" width="2" height="2" fill="currentColor" />
    <rect x="14" y="10" width="2" height="2" fill="currentColor" />
    <rect x="10" y="14" width="2" height="2" fill="currentColor" />
    <rect x="12" y="12" width="2" height="2" fill="currentColor" />
    <rect x="16" y="14" width="2" height="2" fill="currentColor" />
    <rect x="14" y="16" width="4" height="2" fill="currentColor" />
  </svg>
);

export const IconCamera: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="7" y="2" width="6" height="2" fill="currentColor" />
    <rect x="2" y="4" width="16" height="12" fill="currentColor" />
    <rect x="4" y="7" width="12" height="8" fill="black" fillOpacity="0.35" />
    <rect x="6" y="9" width="8" height="4" fill="currentColor" />
  </svg>
);

export const IconGift: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="9" y="2" width="2" height="2" fill="currentColor" />
    <rect x="7" y="4" width="3" height="2" fill="currentColor" />
    <rect x="10" y="4" width="3" height="2" fill="currentColor" />
    <rect x="2" y="6" width="16" height="3" fill="currentColor" />
    <rect x="3" y="9" width="14" height="9" fill="currentColor" />
    <rect x="8" y="6" width="4" height="12" fill="black" fillOpacity="0.35" />
  </svg>
);

export const IconInfo: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="2" y="2" width="16" height="16" fill="currentColor" />
    <rect x="9" y="5" width="2" height="2" fill="black" fillOpacity="0.5" />
    <rect x="9" y="9" width="2" height="6" fill="black" fillOpacity="0.5" />
  </svg>
);

export const IconQuiz: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="2" y="2" width="16" height="16" fill="currentColor" />
    <rect x="6" y="5" width="6" height="2" fill="black" fillOpacity="0.45" />
    <rect x="10" y="7" width="2" height="2" fill="black" fillOpacity="0.45" />
    <rect x="8" y="9" width="2" height="2" fill="black" fillOpacity="0.45" />
    <rect x="8" y="13" width="2" height="2" fill="black" fillOpacity="0.45" />
  </svg>
);

export const IconWord: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="2" y="2" width="16" height="16" fill="currentColor" />
    <rect x="4" y="4" width="4" height="4" fill="black" fillOpacity="0.4" />
    <rect x="8" y="4" width="4" height="4" fill="black" fillOpacity="0.15" />
    <rect x="12" y="4" width="4" height="4" fill="black" fillOpacity="0.4" />
    <rect x="4" y="8" width="4" height="4" fill="black" fillOpacity="0.15" />
    <rect x="8" y="8" width="4" height="4" fill="black" fillOpacity="0.4" />
    <rect x="12" y="8" width="4" height="4" fill="black" fillOpacity="0.15" />
    <rect x="4" y="12" width="4" height="4" fill="black" fillOpacity="0.4" />
    <rect x="8" y="12" width="4" height="4" fill="black" fillOpacity="0.15" />
    <rect x="12" y="12" width="4" height="4" fill="black" fillOpacity="0.4" />
  </svg>
);

export const IconLock: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="6" y="2" width="8" height="8" stroke="currentColor" strokeWidth="2" />
    <rect x="3" y="9" width="14" height="9" fill="currentColor" />
    <rect x="9" y="12" width="2" height="4" fill="black" fillOpacity="0.4" />
  </svg>
);

export const IconHourglass: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="4" y="2" width="12" height="2" fill="currentColor" />
    <rect x="4" y="16" width="12" height="2" fill="currentColor" />
    <rect x="5" y="4" width="10" height="3" fill="currentColor" />
    <rect x="7" y="7" width="6" height="2" fill="currentColor" />
    <rect x="9" y="9" width="2" height="2" fill="currentColor" />
    <rect x="7" y="11" width="6" height="2" fill="currentColor" />
    <rect x="5" y="13" width="10" height="3" fill="currentColor" />
  </svg>
);

export const IconTrophy: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="2" y="3" width="3" height="5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="15" y="3" width="3" height="5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="5" y="2" width="10" height="8" fill="currentColor" />
    <rect x="6" y="10" width="8" height="2" fill="black" fillOpacity="0.35" />
    <rect x="8" y="10" width="4" height="5" fill="currentColor" />
    <rect x="5" y="15" width="10" height="3" fill="currentColor" />
  </svg>
);

export const IconChat: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="2" y="3" width="16" height="11" fill="currentColor" />
    <rect x="5" y="14" width="3" height="3" fill="currentColor" />
    <rect x="5" y="6" width="10" height="2" fill="black" fillOpacity="0.35" />
    <rect x="5" y="9" width="6" height="2" fill="black" fillOpacity="0.35" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <polygon points="2,10 4,8 8,12 16,4 18,6 8,16" fill="currentColor" />
  </svg>
);

export const IconEmptySquare: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const IconMic: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="7" y="2" width="6" height="10" rx="3" fill="currentColor" />
    <rect x="4" y="9" width="2" height="4" fill="currentColor" />
    <rect x="14" y="9" width="2" height="4" fill="currentColor" />
    <rect x="4" y="12" width="12" height="2" fill="currentColor" />
    <rect x="9" y="14" width="2" height="4" fill="currentColor" />
    <rect x="6" y="18" width="8" height="1.5" fill="currentColor" />
  </svg>
);

export const IconPaperclip: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <path
      d="M6 11V6a4 4 0 0 1 8 0v8a2.5 2.5 0 0 1-5 0V7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
    />
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="4" y="5" width="12" height="2" fill="currentColor" />
    <rect x="7" y="2" width="6" height="2" fill="currentColor" />
    <rect x="5" y="7" width="10" height="11" fill="currentColor" />
    <rect x="8" y="9" width="1.5" height="7" fill="black" fillOpacity="0.35" />
    <rect x="10.5" y="9" width="1.5" height="7" fill="black" fillOpacity="0.35" />
  </svg>
);

export const IconPencil: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="12" y="2" width="4" height="4" transform="rotate(45 12 2)" fill="currentColor" />
    <polygon points="2,16 4,18 9,13 6,10" fill="currentColor" />
    <rect x="6.5" y="6.5" width="9" height="4" transform="rotate(45 6.5 6.5)" fill="currentColor" />
  </svg>
);

export const IconSend: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <polygon points="2,3 18,10 2,17 5,10" fill="currentColor" />
  </svg>
);

export const IconPlay: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <polygon points="4,2 17,10 4,18" fill="currentColor" />
  </svg>
);

export const IconPause: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className}>
    <rect x="3" y="2" width="5" height="16" fill="currentColor" />
    <rect x="12" y="2" width="5" height="16" fill="currentColor" />
  </svg>
);
