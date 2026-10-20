import type { Location } from '../services/locations-api';
import { BILLBOARD_TYPE_STYLES } from './billboard-types';
import { iconDataUrl } from './type-icons';

/** Passed to maplibregl.Popup so the chrome overrides in app.scss only hit this popup. */
export const POPUP_CLASS = 'billboard-popup-wrapper';

/** Sets the type colour on the popup wrapper so both the card and its tip can use it. */
export function applyPopupColor(popupElement: HTMLElement, l: Location): void {
  popupElement.style.setProperty('--bp-color', BILLBOARD_TYPE_STYLES[l.type].color);
}

const number = new Intl.NumberFormat('en-US');

/** All text goes through textContent, so data can never inject HTML. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
    node.dir = 'auto'; // Persian/Arabic values render right-to-left
  }
  return node;
}

function icon(name: string): HTMLElement {
  return el('i', 'material-icons bp__icon', name);
}

function stat(iconName: string, label: string, value: string, wide = false): HTMLElement {
  const item = el('div', `bp__stat${wide ? ' bp__stat--wide' : ''}`);
  const text = el('div', 'bp__stat-text');
  text.append(el('div', 'bp__stat-label', label), el('div', 'bp__stat-value', value));
  item.append(icon(iconName), text);
  return item;
}

export function buildPopupContent(l: Location): HTMLElement {
  const style = BILLBOARD_TYPE_STYLES[l.type];
  const card = el('div', 'bp');

  const header = el('div', 'bp__header');
  const badge = el('img', 'bp__type-icon');
  badge.src = iconDataUrl(l.type);
  badge.alt = '';
  const titles = el('div', 'bp__titles');
  titles.append(el('div', 'bp__type', style.label), el('div', 'bp__name', l.name));
  header.append(badge, titles);

  const pills = el('div', 'bp__pills');
  pills.append(el('span', `bp__pill bp__pill--${l.status}`, l.status === 'available' ? 'Available' : 'Booked'));
  if (l.illuminated) {
    const lit = el('span', 'bp__pill bp__pill--lit');
    lit.append(icon('lightbulb'), document.createTextNode('Illuminated'));
    pills.append(lit);
  }

  const stats = el('div', 'bp__stats');
  stats.append(
    stat('straighten', 'Size', `${l.widthM} × ${l.heightM} m`),
    stat('layers', 'Faces', String(l.faces)),
    stat('visibility', 'Daily views', number.format(l.dailyImpressions)),
    stat('payments', 'Per month', `${number.format(l.pricePerMonthIrr)} IRR`),
    stat('location_city', 'District', l.district),
    stat('place', 'Address', l.address, true),
  );

  const body = el('div', 'bp__body');
  body.append(pills, el('p', 'bp__description', l.description), stats, el('div', 'bp__id', l.id));
  card.append(header, body);
  return card;
}
