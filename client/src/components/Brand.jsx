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
        <path transform="translate(20 21)" d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill="#F2B33D" />
      </svg>
      <span className="brand-text">
        <span className="brand-name">WILDWOOD</span>
        <span className="brand-sub">{sub}</span>
      </span>
    </>
  );
}
