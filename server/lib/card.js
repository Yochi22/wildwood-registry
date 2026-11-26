import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { config } from '../config.js';
import { SPECIALTY_LABELS } from './constants.js';
import { qrPng } from './qr.js';
import { brandLogoPath } from './brand.js';

const require = createRequire(import.meta.url);
const fontDir = path.join(path.dirname(require.resolve('@fontsource/archivo/package.json')), 'files');
const FONT = {
  regular: path.join(fontDir, 'archivo-latin-400-normal.woff'),
  bold: path.join(fontDir, 'archivo-latin-700-normal.woff'),
  black: path.join(fontDir, 'archivo-latin-800-normal.woff'),
};

// Tarjeta CR80 (tamaño tarjeta bancaria): 85,6 × 54 mm.
const MM = 72 / 25.4;
const W = 85.6 * MM;
const H = 54 * MM;
const C = { forest: '#0A2B1F', pine: '#13402E', gold: '#F2B33D', mint: '#DDEFE4', sage: '#8CC5A6', muted: '#CFE3D7', ink: '#0E1F17', grey: '#4D5E55' };

function paw(doc, x, y, s, color) {
  doc.save().translate(x, y).scale(s / 64).fillColor(color);
  for (const [cx, cy] of [[22.5, 27], [28.6, 21.5], [35.4, 21.5], [41.5, 27]]) doc.circle(cx, cy, 3.6).fill();
  doc.path('M32 29c5 0 9.5 5.6 9.5 10.3 0 3.2-2.4 4.7-4.8 4.7-1.9 0-3.1-1-4.7-1s-2.8 1-4.7 1c-2.4 0-4.8-1.5-4.8-4.7C22.5 34.6 27 29 32 29Z').fill();
  doc.restore();
}

function hexLogo(doc, x, y, size) {
  const k = size / 64;
  doc.save().translate(x, y).scale(k)
    .polygon([32, 3], [60, 17], [60, 46], [32, 63], [4, 46], [4, 17]).lineWidth(3).fillAndStroke(C.pine, C.gold).restore();
  paw(doc, x, y, size, C.gold);
}

const fmt = (iso) => (iso ? iso : '—');

function label(doc, text, x, y, w, color = C.sage) {
  doc.font('bold').fontSize(4.6).fillColor(color).text(text, x, y, { width: w, characterSpacing: 0.5 });
}
function value(doc, text, x, y, w, color = '#FFFFFF', size = 7) {
  doc.font('bold').fontSize(size).fillColor(color).text(text, x, y, { width: w, lineBreak: false, ellipsis: true });
}

export async function renderCardPdf(d) {
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: `Carnet ${d.reg_number}`, Author: config.brand.name } });
  doc.registerFont('regular', FONT.regular);
  doc.registerFont('bold', FONT.bold);
  doc.registerFont('black', FONT.black);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((res) => doc.on('end', () => res(Buffer.concat(chunks))));

  const logo = brandLogoPath();
  const [es, en] = SPECIALTY_LABELS[d.specialty] || [d.specialty, d.specialty];

  // ---------- Frente ----------
  doc.rect(0, 0, W, H).fill(C.forest);
  if (logo) doc.image(logo, 9, 7, { height: 17 });
  else {
    hexLogo(doc, 9, 7, 16);
    doc.font('black').fontSize(7.5).fillColor('#FFFFFF').text('WILDWOOD', 28, 9);
    doc.font('bold').fontSize(4).fillColor(C.gold).text('TRAINING', 28, 17.5, { characterSpacing: 1.6 });
  }
  const [kindEs, kindEn] = d.specialty === 'emotional_support' ? ['APOYO EMOCIONAL', 'EMOTIONAL SUPPORT'] : d.specialty === 'therapy' ? ['PERRO DE TERAPIA', 'THERAPY DOG'] : ['PERRO DE SERVICIO', 'SERVICE DOG'];
  doc.font('black').fontSize(6.6).fillColor(C.gold).text(kindEs, W - 120, 9, { width: 111, align: 'right' });
  doc.font('bold').fontSize(4.6).fillColor(C.muted).text(kindEn, W - 120, 17.5, { width: 111, align: 'right', characterSpacing: 0.8 });

  const px = 9, py = 31, ps = 62;
  doc.save().roundedRect(px - 1.5, py - 1.5, ps + 3, ps + 3, 4).fill(C.gold).restore();
  if (d.photo) {
    const file = path.join(config.uploadsDir, d.photo);
    if (fs.existsSync(file)) {
      const img = await sharp(file).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
      doc.save().roundedRect(px, py, ps, ps, 3).clip().image(img, px, py, { width: ps, height: ps }).restore();
    }
  } else {
    doc.save().roundedRect(px, py, ps, ps, 3).fill(C.mint).restore();
  }

  const tx = 80, tw = W - tx - 9;
  doc.font('black').fontSize(14).fillColor('#FFFFFF').text(d.dog_name.toUpperCase(), tx, 30, { width: tw, lineBreak: false, ellipsis: true });
  doc.font('regular').fontSize(6).fillColor(C.muted).text(d.breed || '', tx, 46, { width: tw, lineBreak: false, ellipsis: true });
  label(doc, 'GUÍA / HANDLER', tx, 56, tw);
  value(doc, d.owner_name, tx, 61.5, tw);
  label(doc, 'ESPECIALIDAD / SPECIALTY', tx, 72, tw);
  value(doc, `${es} / ${en}`, tx, 77.5, tw, '#FFFFFF', 6.2);
  label(doc, 'EMISIÓN / ISSUED', tx, 88, tw / 2);
  value(doc, fmt(d.issue_date), tx, 93.5, tw / 2);
  label(doc, 'VIGENCIA / VALID TO', tx + tw / 2, 88, tw / 2);
  value(doc, d.lifetime ? 'VITALICIA / LIFETIME' : fmt(d.expiry_date), tx + tw / 2, 93.5, tw / 2, d.lifetime ? C.gold : '#FFFFFF', d.lifetime ? 5.6 : 7);

  const bandH = 17;
  doc.rect(0, H - bandH, W, bandH).fill(C.gold);
  doc.font('black').fontSize(8.5).fillColor(C.forest).text(d.reg_number, 9, H - bandH + 5, { characterSpacing: 0.6 });
  let country = d.country;
  try { country = new Intl.DisplayNames(['es'], { type: 'region' }).of(d.country) || d.country; } catch {}
  doc.font('bold').fontSize(5.6).fillColor(C.forest).text(country.toUpperCase(), W - 110, H - bandH + 6.5, { width: 101, align: 'right' });

  // ---------- Reverso ----------
  doc.addPage({ size: [W, H], margin: 0 });
  doc.rect(0, 0, W, H).fill('#FFFFFF');
  doc.rect(0, 0, W, 4).fill(C.forest);
  const qs = 78;
  const qr = await qrPng(d.reg_number, 600);
  doc.roundedRect(8, 14, qs + 6, qs + 6, 4).lineWidth(1.2).stroke(C.forest);
  doc.image(qr, 11, 17, { width: qs, height: qs });
  doc.font('black').fontSize(5.5).fillColor(C.forest).text('ESCANEA / SCAN', 8, qs + 25, { width: qs + 6, align: 'center', characterSpacing: 0.6 });

  const bx = qs + 24, bw = W - bx - 10;
  doc.font('black').fontSize(8).fillColor(C.forest).text('VERIFICA ESTA CREDENCIAL EN TIEMPO REAL', bx, 16, { width: bw - 12 });
  doc.font('regular').fontSize(5.6).fillColor(C.grey).text("Scan the QR code to confirm this dog's identity, certified tasks and current validity.", bx, doc.y + 3, { width: bw });
  if (d.microchip) {
    doc.font('bold').fontSize(4.6).fillColor(C.grey).text('MICROCHIP', bx, doc.y + 6, { characterSpacing: 0.5 });
    doc.font('bold').fontSize(7).fillColor(C.ink).text(d.microchip.replace(/(\d{3})(?=\d)/g, '$1 '), bx, doc.y + 1.5, { width: bw });
  }
  doc.font('regular').fontSize(4.4).fillColor(C.grey).text(
    `Carnet propiedad de ${config.brand.name}. La validez se confirma únicamente mediante el código QR.\nProperty of ${config.brand.name}.`,
    bx, H - 30, { width: bw }
  );

  doc.end();
  return done;
}
