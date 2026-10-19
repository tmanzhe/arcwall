const paths = {
  spark: (
    <>
      <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z" />
      <path d="m20 3 .6 1.4L22 5l-1.4.6L20 7l-.6-1.4L18 5l1.4-.6Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  hand: (
    <>
      <path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7-3 0-5-2-7-5l-3-4a1.5 1.5 0 0 1 2.4-1.8L8 15" />
    </>
  ),
  shapes: (
    <>
      <rect x="3" y="3" width="10" height="10" rx="2" />
      <circle cx="16" cy="16" r="5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </>
  ),
  pen: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" />
    </>
  ),
  eraser: (
    <>
      <path d="m15 3 6 6-11 11H6l-4-4L15 3ZM8 10l7 7M10 20h12" />
    </>
  ),
  map: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      <path d="m7 7 10 1-1 9-8-1Z" />
    </>
  ),
  undo: (
    <>
      <path d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  expand: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
    </>
  ),
  collapse: (
    <>
      <path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M8 21l4-4 4 4M8 8h8m-8 4h5" />
    </>
  ),
  projector: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="3" />
      <circle cx="16" cy="12.5" r="3.5" />
      <path d="M6 10h2m-2 4h2M6 3l1 3m10-3-1 3" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5" />
    </>
  ),
  pause: (
    <>
      <path d="M8 4v16M16 4v16" />
    </>
  ),
  play: <path d="m7 3 14 9-14 9Z" />,
  camera: (
    <>
      <rect x="2" y="6" width="15" height="13" rx="3" />
      <path d="m17 10 5-3v11l-5-3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  panel: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M15 3v18" />
    </>
  ),
  corners: (
    <>
      <path d="m8 3-5 5m0-5v5h5m8 13 5-5m0 5v-5h-5" />
      <circle cx="17" cy="7" r="3" />
      <path d="m5 19 3-6 3 6Z" />
    </>
  ),
};
export default function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.spark}
    </svg>
  );
}
