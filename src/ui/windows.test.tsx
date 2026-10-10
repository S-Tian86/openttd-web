// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndustryWindow } from './IndustryWindow';
import { TileInfo } from './TileInfo';
import { TownWindow } from './TownWindow';

const TOWN = {
  index: 0,
  name: 'Invenville',
  isCity: true,
  population: 412,
  houses: 17,
  x: 20,
  y: 30,
};
const ROAD = {
  tile: 1300,
  x: 20,
  y: 20,
  z: 1,
  kind: 'road' as const,
  owner: 'town' as const,
  townIndex: 0,
  industryIndex: null,
};
const GRASS = { ...ROAD, kind: 'grass' as const, owner: 'none' as const, townIndex: null };

afterEach(cleanup);

describe('town and industry windows', () => {
  it('shows population and houses', () => {
    render(<TownWindow locale="en" info={TOWN} />);
    expect(screen.getByText('Population: 412')).toBeTruthy();
    expect(screen.getByText('Houses: 17')).toBeTruthy();
  });

  it('names an industry after its town, in both languages', () => {
    const info = { index: 0, type: 'coalMine' as const, townName: 'Invenville', x: 40, y: 10 };
    const { unmount } = render(<IndustryWindow locale="en" info={info} />);
    expect(screen.getByText('Invenville Coal Mine')).toBeTruthy();
    expect(screen.getByText('Location: 40 × 10')).toBeTruthy();
    unmount();
    render(<IndustryWindow locale="es" info={info} />);
    expect(screen.getByText('Mina de carbón de Invenville')).toBeTruthy();
  });

  it('links a town road to its town', () => {
    const openTown = vi.fn<(index: number) => void>();
    render(<TileInfo locale="en" info={ROAD} townName="Invenville" onOpenTown={openTown} />);
    expect(screen.getByText('Road')).toBeTruthy();
    expect(screen.getByText('Owner: Invenville')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Town window' }));
    expect(openTown).toHaveBeenCalledWith(0);
  });

  it('shows no town link for grass', () => {
    render(<TileInfo locale="en" info={GRASS} townName={null} onOpenTown={() => undefined} />);
    expect(screen.getByText('Owner: None')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Town window' })).toBeNull();
  });
});
