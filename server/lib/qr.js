import QRCode from 'qrcode';
import { config } from '../config.js';

export const profileUrl = (reg) => `${config.publicUrl}/v/${encodeURIComponent(reg)}`;

// Corrección de errores "Q" (25 %): el QR sigue leyéndose aunque el carnet se raye.
const opts = { errorCorrectionLevel: 'Q', margin: 2, color: { dark: '#0A2B1F', light: '#FFFFFF' } };

export const qrSvg = (reg) => QRCode.toString(profileUrl(reg), { ...opts, type: 'svg' });
export const qrPng = (reg, width = 1024) => QRCode.toBuffer(profileUrl(reg), { ...opts, type: 'png', width });
