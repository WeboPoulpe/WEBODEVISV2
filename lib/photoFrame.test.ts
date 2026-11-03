import { describe, expect, it } from 'vitest';
import { DEFAULT_FRAME, frameImgStyle, parsePhotoFrame, parsePlacement, placementSize } from './photoFrame';

describe('photo : cadrage', () => {
  it('absent ou illisible : null ; valeurs ramenées dans leurs bornes', () => {
    expect(parsePhotoFrame(null)).toBeNull();
    expect(parsePhotoFrame('x')).toBeNull();
    expect(parsePhotoFrame({ x: -20, y: 140, zoom: 999, fit: 'bizarre' })).toEqual({ x: 0, y: 100, zoom: 300, fit: 'cover' });
    expect(parsePhotoFrame({ x: 'a', fit: 'contain' })).toEqual({ ...DEFAULT_FRAME, fit: 'contain' });
  });

  it('style de l’image : point gardé visible, zoom autour de ce point, photo entière sans zoom', () => {
    expect(frameImgStyle(null)).toEqual({ objectFit: 'cover', objectPosition: '50% 50%' });
    expect(frameImgStyle({ x: 20, y: 80, zoom: 150, fit: 'cover' })).toEqual({
      objectFit: 'cover', objectPosition: '20% 80%', transform: 'scale(1.5)', transformOrigin: '20% 80%',
    });
    expect(frameImgStyle({ x: 20, y: 80, zoom: 150, fit: 'contain' })).toEqual({ objectFit: 'contain', objectPosition: '50% 50%' });
  });
});

describe('photo : place et taille', () => {
  it('place inconnue : null ; taille par défaut et bornée selon la place', () => {
    expect(parsePlacement(undefined)).toBeNull();
    expect(parsePlacement({ pos: 'dessus' })).toBeNull();
    expect(parsePlacement({ pos: 'left' })).toEqual({ pos: 'left', size: 40 });
    expect(parsePlacement({ pos: 'right', size: 90 })).toEqual({ pos: 'right', size: 60 });
    expect(parsePlacement({ pos: 'top', size: 5 })).toEqual({ pos: 'top', size: 30 });
    expect(parsePlacement({ pos: 'bottom' })).toEqual({ pos: 'bottom', size: 66 });
    expect(parsePlacement({ pos: 'none', size: 50 })).toEqual({ pos: 'none', size: 0 });
  });

  it('changer de place remet une taille valable', () => {
    expect(placementSize('left', 90)).toBe(60);
    expect(placementSize('top', 40)).toBe(40);
    expect(placementSize('top', undefined)).toBe(66);
  });
});
