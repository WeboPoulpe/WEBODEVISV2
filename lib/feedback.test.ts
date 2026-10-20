import { describe, expect, it } from 'vitest';
import { addToast, toastDuration, toastRole, type Toast } from './feedback';

const t = (id: number, message = `m${id}`, tone: Toast['tone'] = 'info'): Toast => ({ id, message, tone });

describe('bandeaux de l’app', () => {
  it('garde les trois plus récents', () => {
    let list: Toast[] = [];
    for (let i = 1; i <= 5; i++) list = addToast(list, t(i));
    expect(list.map((x) => x.id)).toEqual([3, 4, 5]);
  });

  it('ne répète pas un message déjà affiché', () => {
    const list = addToast([t(1, 'Enregistré'), t(2, 'Autre')], t(3, 'Enregistré'));
    expect(list.map((x) => x.id)).toEqual([2, 3]);
  });

  it('distingue une erreur d’une information', () => {
    expect(addToast([t(1, 'Oups', 'error')], t(2, 'Oups', 'info'))).toHaveLength(2);
    expect(toastRole('error')).toBe('alert');
    expect(toastRole('success')).toBe('status');
    expect(toastDuration('error')).toBeGreaterThan(toastDuration('info'));
  });
});
