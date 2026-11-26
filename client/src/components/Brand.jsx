import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

let cache;
export function useBrand() {
  const [brand, setBrand] = useState(cache);
  useEffect(() => {
    if (cache) return;
    api('/api/public/config')
      .then((c) => {
        cache = c;
        setBrand(c);
      })
      .catch(() => {});
  }, []);
  return brand || { brand: { name: 'Wildwood Training', siteUrl: 'https://wildwood-training.com/' }, hasLogo: false };
}

export function Logo({ size = 36, sub = 'REGISTRY' }) {
  const { hasLogo } = useBrand();
  if (hasLogo) return <img src="/api/public/logo.png" alt="Wildwood Training" style={{ height: size + 4, width: 'auto' }} />;
  return (
    <>
      <svg role="img" aria-label="Wildwood Training" width={size} height={size * 1.04} viewBox="0 0 64 66">
        <polygon points="32,3 60,17 60,46 32,63 4,46 4,17" fill="#13402E" stroke="#F2B33D" strokeWidth="3" />
        <g fill="#F2B33D">
          <circle cx="22.5" cy="27" r="3.6" />
          <circle cx="28.6" cy="21.5" r="3.6" />
          <circle cx="35.4" cy="21.5" r="3.6" />
          <circle cx="41.5" cy="27" r="3.6" />
          <path d="M32 29c5 0 9.5 5.6 9.5 10.3 0 3.2-2.4 4.7-4.8 4.7-1.9 0-3.1-1-4.7-1s-2.8 1-4.7 1c-2.4 0-4.8-1.5-4.8-4.7C22.5 34.6 27 29 32 29Z" />
        </g>
      </svg>
      <span className="brand-text">
        <span className="brand-name">WILDWOOD</span>
        <span className="brand-sub">{sub}</span>
      </span>
    </>
  );
}
