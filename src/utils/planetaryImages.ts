import lunarShackletonImg from '../assets/images/lunar_shackleton_crater_1794644039510.jpg';
import marsJezeroImg from '../assets/images/mars_jezero_crater_1794644039779.jpg';
import earthHorizonImg from '../assets/images/earth_orbital_horizon_1794644040980.jpg';
import atacamaImg from '../assets/images/atacama_analog_terrain_1794654554134.jpg';
import mcmurdoImg from '../assets/images/mcmurdo_dry_valleys_1794654554197.jpg';
import icelandImg from '../assets/images/iceland_volcanic_highlands_1794654554733.jpg';
import namibImg from '../assets/images/namib_dune_plains_1794654554715.jpg';
import type { TargetId } from '../engine/types';

export const PLANETARY_VISUAL_REFS: Record<TargetId, string> = {
  shackleton: lunarShackletonImg,
  jezero: marsJezeroImg,
};

export const EARTH_HORIZON_VISUAL = earthHorizonImg;

export const SITE_VISUAL_REFS: Record<string, string> = {
  atacama: atacamaImg,
  mcmurdo: mcmurdoImg,
  iceland: icelandImg,
  namib: namibImg,
};

export const TUNNEL_GALLERY_ITEMS = [
  {
    src: lunarShackletonImg,
    title: 'Shackleton Crater · Moon',
    subtitle: '89.54°S · LRO LOLA / Diviner',
    targetId: 'shackleton' as TargetId,
  },
  {
    src: atacamaImg,
    title: 'Atacama Desert · Chile',
    subtitle: '24.08°S · Hyper-Arid Sulfate Core',
    siteId: 'atacama',
  },
  {
    src: marsJezeroImg,
    title: 'Jezero Crater · Mars',
    subtitle: '18.38°N · MOLA / THEMIS Delta',
    targetId: 'jezero' as TargetId,
  },
  {
    src: mcmurdoImg,
    title: 'McMurdo Dry Valleys · Antarctica',
    subtitle: '77.50°S · Cryogenic Permafrost',
    siteId: 'mcmurdo',
  },
  {
    src: icelandImg,
    title: 'Askja Highlands · Iceland',
    subtitle: '65.03°N · Basaltic Tephra Sandur',
    siteId: 'iceland',
  },
  {
    src: namibImg,
    title: 'Namib Plains · Namibia',
    subtitle: '23.56°S · Aeolian Gravel & Pans',
    siteId: 'namib',
  },
  {
    src: earthHorizonImg,
    title: 'Earth Orbital Limb',
    subtitle: 'NASADEM · MODIS · NASA POWER',
  },
  {
    src: marsJezeroImg,
    title: 'Neretva Vallis Paleodelta',
    subtitle: 'Mars Lacustrine Stratigraphy',
    targetId: 'jezero' as TargetId,
  },
  {
    src: lunarShackletonImg,
    title: 'Lunar South Polar Rim',
    subtitle: 'Permanent Shadow Cold-Trap',
    targetId: 'shackleton' as TargetId,
  },
];
