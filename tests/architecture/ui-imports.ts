// Deliberately breaks the ui/ barrier with imports; boundary.test.ts checks that the
// linter rejects them. The ui import is the control: ui may import ui.
import { Scene } from 'phaser';
import { GameSession } from '../../src/app/session';
import { TILE_PX } from '../../src/render/projection';
import { translate } from '../../src/ui/i18n/i18n';

export const leaks = [Scene, GameSession, TILE_PX, translate];
