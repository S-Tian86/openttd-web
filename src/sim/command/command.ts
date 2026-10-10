import type { GameState } from '../game';

export type Command = { type: 'pause'; paused: boolean };
export type CommandMode = 'test' | 'exec';
export type CommandResult = { ok: true; cost: number } | { ok: false; error: string };

/** construction.command_pause_level default: no construction while paused (time.md §4.8). */
export const COMMAND_PAUSE_LEVEL = 1;

/** Level per command type. Port of command.cpp:IsCommandAllowedWhilePaused. */
const PAUSE_LEVEL: Record<Command['type'], number> = {
  pause: 0, // CommandType::ServerSetting
};

/** Runs a command in test or exec mode. Port of command.cpp:Command<>::Do (single player). */
export function execute(state: GameState, command: Command, mode: CommandMode): CommandResult {
  if (state.paused && PAUSE_LEVEL[command.type] > COMMAND_PAUSE_LEVEL) {
    return { ok: false, error: 'error.notAllowedWhilePaused' };
  }
  switch (command.type) {
    case 'pause':
      // Port of misc_cmd.cpp:CmdPause (PauseMode::Normal only).
      if (mode === 'exec') state.paused = command.paused;
      return { ok: true, cost: 0 };
  }
}
