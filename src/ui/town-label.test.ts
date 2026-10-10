import { describe, expect, it } from 'vitest';
import { townLabel } from './town-label';

const TOWN = { name: 'Invenville', population: 12345, isCity: false };

describe('townLabel (viewport.cpp ViewportAddTownStrings)', () => {
  it('shows the name and population up close (population_in_label defaults to true)', () => {
    expect(townLabel('en', TOWN, false)).toBe('Invenville (12,345)');
    expect(townLabel('es', TOWN, false)).toBe('Invenville (12.345)');
  });

  it('marks a city up close', () => {
    expect(townLabel('en', { ...TOWN, isCity: true }, false)).toBe('Invenville (12,345) ★');
  });

  it('shows only the name when small, for towns and cities', () => {
    expect(townLabel('en', TOWN, true)).toBe('Invenville');
    expect(townLabel('en', { ...TOWN, isCity: true }, true)).toBe('Invenville');
  });
});
