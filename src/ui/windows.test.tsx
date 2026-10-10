// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndustryWindow } from './IndustryWindow';
import { depotName } from './names';
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
  stationIndex: null,
  depotIndex: null,
  costToClear: null,
};
const GRASS = {
  ...ROAD,
  kind: 'grass' as const,
  owner: 'none' as const,
  townIndex: null,
  costToClear: 15,
};

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
    render(
      <TileInfo
        locale="en"
        info={ROAD}
        townName="Invenville"
        station={null}
        depot={null}
        onOpenTown={openTown}
      />,
    );
    expect(screen.getByText('Road')).toBeTruthy();
    expect(screen.getByText('Owner: Invenville')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Town window' }));
    expect(openTown).toHaveBeenCalledWith(0);
  });

  it('shows no town link for grass', () => {
    render(
      <TileInfo
        locale="en"
        info={GRASS}
        townName={null}
        station={null}
        depot={null}
        onOpenTown={() => undefined}
      />,
    );
    expect(screen.getByText('Owner: None')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Town window' })).toBeNull();
  });

  it('names stations and depots and shows the owners of a crossing', () => {
    const base = {
      ...ROAD,
      townIndex: null,
      stationIndex: null,
      depotIndex: null,
      costToClear: 74,
    };
    const { unmount } = render(
      <TileInfo
        locale="en"
        info={{ ...base, kind: 'station', owner: 'company', stationIndex: 0 }}
        townName={null}
        station={{ index: 0, townName: 'Invenville', nameKind: 'north' }}
        depot={null}
        onOpenTown={() => undefined}
      />,
    );
    for (const text of [
      'Railway station',
      'Invenville North',
      'Owner: Your company',
      'Cost to clear: £74',
    ])
      expect(screen.getByText(text)).toBeTruthy();
    unmount();
    render(
      <TileInfo
        locale="es"
        info={{ ...base, kind: 'crossing', owner: 'company', townIndex: 0, costToClear: null }}
        townName="Invenville"
        station={null}
        depot={null}
        onOpenTown={() => undefined}
      />,
    );
    for (const text of [
      'Paso a nivel',
      'Propietario del ferrocarril: Tu empresa',
      'Propietario de la carretera: Invenville',
      'Coste de despeje: N/D',
    ])
      expect(screen.getByText(text)).toBeTruthy();
  });

  it('numbers the second depot of a town', () => {
    expect([
      depotName('en', { index: 0, townName: 'Invenville', townCn: 0 }),
      depotName('en', { index: 1, townName: 'Invenville', townCn: 1 }),
    ]).toEqual(['Invenville Train Depot', 'Invenville Train Depot #2']);
  });

  it('shows Population: 0 for a town whose houses were all demolished (Review Focus 3)', () => {
    render(<TownWindow locale="en" info={{ ...TOWN, population: 0, houses: 0 }} />);
    expect(screen.getByText('Population: 0')).toBeTruthy();
  });
});
