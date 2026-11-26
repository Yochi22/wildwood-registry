const P = {
  home: 'M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8Z',
  list: 'M4 6h16M4 12h16M4 18h10',
  plus: 'M12 5v14M5 12h14',
  users: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2',
  clock: 'M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1-4 4-6 8-6s7 2 8 6',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M20 6 9 17l-5-5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  dots: 'M12 6.5v.01M12 12v.01M12 17.5v.01',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M21 14v.01M14 21h7v-4',
  download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2',
  chevL: 'm15 6-6 6 6 6',
  chevR: 'm9 6 6 6-6 6',
  chevsL: 'm11 6-6 6 6 6M19 6l-6 6 6 6',
  chevsR: 'm13 6 6 6-6 6M5 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  sort: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 14l2-2 4 4M15 9.5v.01',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  external: 'M7 17 17 7M9 7h8v8',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z',
  alert: 'M12 8v5M12 16.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  minus: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12h8',
  columns: 'M3 4h18v16H3zM9 4v16M15 4v16',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  phone: 'M7 2.5h10v19H7zM11 18h2',
  infinity: 'M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z',
};

export default function Icon({ name, size = 18, stroke = 2, ...rest }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}

export function Paw({ size = 16, color = 'currentColor', ...rest }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={color} {...rest}>
      <circle cx="5" cy="10" r="2.2" />
      <circle cx="9.3" cy="5.6" r="2.2" />
      <circle cx="14.7" cy="5.6" r="2.2" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M12 11c3.3 0 6.4 3.8 6.4 6.9 0 2.1-1.6 3.1-3.2 3.1-1.3 0-2.1-.7-3.2-.7s-1.9.7-3.2.7c-1.6 0-3.2-1-3.2-3.1C5.6 14.8 8.7 11 12 11Z" />
    </svg>
  );
}

export function DogGlyph({ size = 48 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="#3E7D5E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 14c-6 2-10 10-9 18 1 5 5 6 8 3" />
      <path d="M46 14c6 2 10 10 9 18-1 5-5 6-8 3" />
      <path d="M18 14c4-3 9-4 14-4s10 1 14 4c2 6 3 13 2 20-1 9-8 16-16 16s-15-7-16-16c-1-7 0-14 2-20Z" />
      <circle cx="25" cy="30" r="2" fill="#3E7D5E" />
      <circle cx="39" cy="30" r="2" fill="#3E7D5E" />
      <path d="M28 40c2 2 6 2 8 0M32 37v3" />
    </svg>
  );
}
