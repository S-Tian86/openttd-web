# Time: ticks, days, calendar and economy dates

## 1. Purpose

The game advances in fixed **ticks** of nominally 27 ms. Every 74 ticks one **day** passes.
OpenTTD keeps two dates: the **calendar** date (what the player sees; drives engine
introduction, inflation, the game end year) and the **economy** date (drives production,
payments, company finances, vehicle running costs). In the default "calendar" timekeeping
mode the two are always equal. Periodic work is registered as timers on the tick, the
calendar day/month/year or the economy day/week/month/quarter/year.

## 2. Source files

| File                                   | Key items                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/timer/timer_game_tick.h/.cpp`     | `TimerGameTick::counter`, `Ticks::DAY_TICKS` and other tick cycles; tick timer manager       |
| `src/timer/timer_game_common.h/.cpp`   | `Date`/`Year`/`Month`/`Day` types, leap years, `CalendarConvertDateToYMD`/`YMDToDate`, const |
| `src/timer/timer_game_calendar.h/.cpp` | Calendar date state, `TimerManager<TimerGameCalendar>::Elapsed` (day roll, minutes-per-year) |
| `src/timer/timer_game_economy.h/.cpp`  | Economy date state, wallclock 30/360 conversion, `TimerManager<TimerGameEconomy>::Elapsed`   |
| `src/timer/timer_manager.h`            | `base_timer_sorter`: timers kept in a `std::set` ordered by (trigger, priority, pointer)     |
| `src/timer/timer.h`                    | `IntervalTimer`, `TimeoutTimer`                                                              |
| `src/gfx_type.h`                       | `MILLISECONDS_PER_TICK = 27`                                                                 |
| `src/gfx.cpp`                          | `_game_speed`, `ChangeGameSpeed` (fast-forward)                                              |
| `src/video/video_driver.hpp/.cpp`      | `GetGameInterval`, `VideoDriver::GameLoop`, `Tick`, `ALLOWED_DRIFT`                          |
| `src/openttd.cpp`                      | `GameLoop` (real-time timers, then `StateGameLoop`), `StateGameLoop` (one game tick)         |
| `src/misc.cpp`                         | `InitializeGame`: start date, `_game_speed = 100`, `_cur_tileloop_tile = 1`                  |
| `src/misc_cmd.cpp`                     | `CmdPause`                                                                                   |
| `src/command.cpp`                      | `IsCommandAllowedWhilePaused`                                                                |
| `src/toolbar_gui.cpp`                  | `ToolbarPauseClick`, `ToolbarFastForwardClick`                                               |
| `src/vehicle.cpp`                      | `RunVehicleCalendarDayProc`, `RunEconomyVehicleDayProc`, `CallVehicleTicks`                  |
| `src/landscape.cpp`                    | `CallLandscapeTick`, `RunTileLoop` (see map.md)                                              |
| `src/settings_table.cpp`               | `ChangeTimekeepingUnits`, `ChangeMinutesPerYear`                                             |

## 3. State

| Field                                     | Type         | Meaning                                                            |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------ |
| `TimerGameTick::counter`                  | `uint64_t`   | Monotonic ticks since game start; +1 per state tick                |
| `TimerGameCalendar::date`                 | `int32_t`    | Days since 0000-01-01 (proleptic Gregorian, year 0 is a leap year) |
| `TimerGameCalendar::date_fract`           | `uint16_t`   | Ticks into the current day, `0..DAY_TICKS-1` (0..73)               |
| `TimerGameCalendar::sub_date_fract`       | `uint16_t`   | Accumulator for slowed calendar (minutes_per_calendar_year != 12)  |
| `TimerGameCalendar::year` / `month`       | `int32_t`/u8 | Cached Y/M of `date`; month 0..11                                  |
| `TimerGameEconomy::date`                  | `int32_t`    | Economy day counter (same as calendar in calendar mode)            |
| `TimerGameEconomy::date_fract`            | `uint16_t`   | 0..73                                                              |
| `TimerGameEconomy::year` / `month`        | `int32_t`/u8 | Cached Y/M of economy date                                         |
| `TimerGameEconomy::days_since_last_month` | `uint`       | Reset to 0 after month timers fire                                 |
| `_pause_mode`                             | bitset (u8)  | `PauseMode` bits; game is paused if any bit is set (`openttd.h`)   |
| `_game_speed`                             | `uint16_t`   | Percent; 100 = 1x, 0 = unlimited (`gfx.cpp`)                       |

`Day` is 1-based (1..31). `YearMonthDay {year, month, day}` is the triplet form.
Saved (`saveload/misc_sl.cpp`): calendar and economy `date`/`date_fract`, `tick_counter`,
`days_since_last_month`, `calendar_sub_date_fract`.

## 4. Rules and formulas

### 4.1 Constants

| Constant                                                         | Value                          | Where                                   |
| ---------------------------------------------------------------- | ------------------------------ | --------------------------------------- |
| `MILLISECONDS_PER_TICK`                                          | 27                             | `gfx_type.h`                            |
| `Ticks::DAY_TICKS`                                               | 74                             | `timer_game_tick.h` (74 × 27 = 1998 ms) |
| `Ticks::TICKS_PER_SECOND`                                        | 1000/27 = 37 (integer)         | `timer_game_tick.h`                     |
| `Ticks::STATION_RATING_TICKS`                                    | 185                            | `timer_game_tick.h`                     |
| `Ticks::STATION_ACCEPTANCE_TICKS`                                | 250                            | `timer_game_tick.h`                     |
| `Ticks::STATION_LINKGRAPH_TICKS`                                 | 504                            | `timer_game_tick.h`                     |
| `Ticks::CARGO_AGING_TICKS`                                       | 185                            | `timer_game_tick.h`                     |
| `Ticks::INDUSTRY_PRODUCE_TICKS`                                  | 256                            | `timer_game_tick.h`                     |
| `Ticks::TOWN_GROWTH_TICKS`                                       | 70                             | `timer_game_tick.h`                     |
| `Ticks::INDUSTRY_CUT_TREE_TICKS`                                 | 512                            | `timer_game_tick.h`                     |
| `DAYS_IN_YEAR` / `DAYS_IN_LEAP_YEAR`                             | 365 / 366                      | `timer_game_common.h` `TimerGameConst`  |
| `MONTHS_IN_YEAR`                                                 | 12                             | `timer_game_common.h`                   |
| `SECONDS_PER_DAY`                                                | 2 (approximate, display only)  | `timer_game_common.h`                   |
| `ORIGINAL_BASE_YEAR` / `ORIGINAL_END_YEAR` / `ORIGINAL_MAX_YEAR` | 1920 / 2051 / 2090             | `timer_game_common.h`                   |
| `MIN_YEAR` / `MAX_YEAR`                                          | 0 / 5 000 000                  | `timer_game_common.h`                   |
| `DEF_START_YEAR` / `DEF_END_YEAR`                                | 1950 / 2050                    | `timer_game_common.h`                   |
| `DAYS_TILL_ORIGINAL_BASE_YEAR`                                   | 701 265 (= date of 1920-01-01) | `timer_game_common.h`                   |
| `INVALID_DATE` / `INVALID_YEAR`                                  | -1 / -1                        | `timer_game_common.h`                   |
| `DEF_MINUTES_PER_YEAR`                                           | 12                             | `timer_game_calendar.h` `CalendarTime`  |
| `FROZEN_MINUTES_PER_YEAR`                                        | 0                              | `timer_game_calendar.h`                 |
| `MAX_MINUTES_PER_YEAR`                                           | 10 080                         | `timer_game_calendar.h`                 |
| `DAYS_IN_ECONOMY_YEAR` / `DAYS_IN_ECONOMY_MONTH`                 | 360 / 30                       | `timer_game_economy.h` (wallclock only) |
| `ALLOWED_DRIFT`                                                  | 5                              | `video_driver.hpp`                      |

Start date 1950-01-01 = date 712 223.

### 4.2 Date arithmetic (`timer_game_common.h/.cpp`)

```
IsLeapYear(y) = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)          // TimerGame::IsLeapYear
DateAtStartOfYear(y) = 365*y + (y == 0 ? 0 : (y-1)/4 - (y-1)/100 + (y-1)/400 + 1)
DateToYear(d) = d / 366        // approximation: source hardcodes 366 (see §8)

CalendarConvertDateToYMD(d):                                              // timer_game_common.cpp
  yr  = 400 * (d / (365*400 + 97)); rem = d % (365*400 + 97)
  if rem >= 365*100 + 25: yr += 100; rem -= 365*100 + 25
                          yr += 100 * (rem / (365*100 + 24)); rem %= 365*100 + 24
  if !IsLeapYear(yr) && rem >= 365*4: yr += 4; rem -= 365*4
  yr += 4 * (rem / (365*4 + 1)); rem %= 365*4 + 1
  while rem >= daysIn(yr): rem -= daysIn(yr); yr++
  if !IsLeapYear(yr) && rem >= ACCUM_MAR - 1: rem++      // skip Feb 29; ACCUM_MAR = 60
  (month, day) = _month_date_from_year_day[rem]          // 366-entry table, leap-year layout

CalendarConvertYMDToDate(y, m, d):
  days = _accum_days_for_month[m] + d - 1                // leap-year cumulative: 0,31,60,91,121,152,182,213,244,274,305,335
  if !IsLeapYear(y) && days >= ACCUM_MAR: days--
  return DateAtStartOfYear(y) + days
```

Economy conversion (`timer_game_economy.cpp:ConvertDateToYMD/ConvertYMDToDate`): in calendar
mode identical to the above. In wallclock mode: `year = d / 360`, `month = (d % 360) / 30`,
`day = d % 30 + 1`; inverse `date = (year*12 + month) * 30 + day - 1`.

### 4.3 One game tick (`openttd.cpp:StateGameLoop`)

```
if _pause_mode.Any() or HasModalProgress(): (only game-script loop runs) return
AnimateAnimatedTiles()
if TimerManager<Calendar>.Elapsed(1): RunVehicleCalendarDayProc()
TimerManager<Economy>.Elapsed(1)
TimerManager<Tick>.Elapsed(1)            // counter++ then fire tick timers
RunTileLoop()                            // see map.md
CallVehicleTicks()                       // RunEconomyVehicleDayProc; LoadUnloadStation(st) for every station; v->Tick() for every vehicle
CallLandscapeTick()                      // OnTick_Town, OnTick_Trees, OnTick_Station, OnTick_Industry, OnTick_Companies, OnTick_LinkGraph
AI::GameLoop(); Game::GameLoop()
UpdateLandscapingLimits(); CallWindowGameTickEvent(); NewsLoop()
```

All of this runs as `OWNER_NONE` (`_current_company` backed up). The order is load-bearing
for determinism (shared `Random()`).

### 4.4 Calendar day advance (`timer_game_calendar.cpp:TimerManager<TimerGameCalendar>::Elapsed`)

```
if game_mode == MENU: return false
mpy = settings.economy.minutes_per_calendar_year
if mpy == 0: return false                                // frozen calendar
if mpy != 12:
  sub_date_fract += 74
  threshold = mpy * 74 / 12
  if sub_date_fract < threshold: return false
  sub_date_fract = min(sub_date_fract - threshold, 73)
date_fract++
if date_fract < 74: return true
date_fract = 0; sub_date_fract = 0; date++
ymd = ConvertDateToYMD(date); new_month = ymd.month != month; new_year = ymd.year != year
month = ymd.month; year = ymd.year                       // updated BEFORE timers fire
fire DAY on all timers; if new_month fire MONTH; if new_year fire YEAR
if year == MAX_YEAR + 1: year--; date -= daysIn(year)    // clamp at 5 000 000
return true
```

The calendar manager never fires `WEEK` or `QUARTER`. Return value `true` means "date_fract
moved"; `RunVehicleCalendarDayProc` runs then.

### 4.5 Economy day advance (`timer_game_economy.cpp:TimerManager<TimerGameEconomy>::Elapsed`)

```
if game_mode == MENU: return false
date_fract++; if date_fract < 74: return true
date_fract = 0; date++; days_since_last_month++
ymd = ConvertDateToYMD(date); new_month/new_year as above; update month, year
fire DAY
if date % 7 == 3: fire WEEK
if new_month: fire MONTH; if month % 3 == 0: fire QUARTER
if new_year: fire YEAR
if new_month: days_since_last_month = 0
if year == MAX_YEAR + 1: year--; shift date, every vehicle and link graph back by daysIn(year)
```

No speed setting applies to the economy clock: always 74 ticks per day.

### 4.6 Timer dispatch order (`timer_manager.h:base_timer_sorter`, `timer_game_common.h`)

Timers live in one `std::set` per clock, ordered by `TPeriod` (trigger first, then priority),
then by pointer. `Elapsed(trigger)` is called on every timer; each fires only if its own
trigger matches. Priority order: `NONE, COMPANY, DISASTER, ENGINE, INDUSTRY, STATION,
SUBSIDY, TOWN, VEHICLE`. Only one timer may exist per (trigger, priority) other than `NONE`
(asserted in `Validate`), because non-`NONE` timers may call `Random()`.

Tick timers (`timer_game_tick.cpp:IntervalTimer<TimerGameTick>::Elapsed`):
`elapsed += delta; count = number of whole periods; elapsed -= count*period; if count>0 callback(count)`.
Period 0 disables the timer. Calendar/economy interval timers call `callback(1)`.

### 4.7 What runs when (game state only)

| Clock / trigger         | Handler (file)                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| every tick              | §4.3 list; `OnTick_Station` rating every 185 ticks per station (`delete_ctr`), acceptance every 250 ticks offset by station index (`station_cmd.cpp:OnTick_Station`); `OnTick_Industry` → `ProduceIndustryGoods` (256-tick cycle)                                               |
| tick, 1/74 vehicles     | `RunEconomyVehicleDayProc`: vehicles with `index % 74 == economy.date_fract` get `OnNewEconomyDay` (train: running cost, value decrease every 8 days, breakdown/service/order checks) (`vehicle.cpp`, `train_cmd.cpp:Train::OnNewEconomyDay`)                                   |
| calendar tick, 1/74 veh | `RunVehicleCalendarDayProc`: `index % 74 == calendar.date_fract` → `OnNewCalendarDay` (`AgeVehicle`)                                                                                                                                                                            |
| calendar DAY            | `_calendar_engines_daily` (ENGINE) (`engine.cpp`)                                                                                                                                                                                                                               |
| calendar MONTH          | `_calendar_inflation_monthly` (COMPANY, `economy.cpp`); `_calendar_engines_monthly` (ENGINE)                                                                                                                                                                                    |
| calendar YEAR           | end-of-game check (`highscore_gui.cpp`), euro switch (`currency.cpp`)                                                                                                                                                                                                           |
| economy DAY             | `_economy_disaster_daily` (DISASTER); `_economy_industries_daily` (INDUSTRY)                                                                                                                                                                                                    |
| economy MONTH           | `_economy_companies_monthly` (COMPANY: `CompaniesGenStatistics`, `CompaniesPayInterest`, `HandleEconomyFluctuations`); `_economy_industries_monthly` (INDUSTRY); `_economy_stations_monthly` (STATION); `_economy_subsidies_monthly` (SUBSIDY); `_economy_towns_monthly` (TOWN) |
| economy YEAR            | `_economy_companies_yearly` (COMPANY, rotates `yearly_expenses`); `_economy_towns_yearly` (TOWN, house age); `_economy_vehicles_yearly` (VEHICLE, profit rollover)                                                                                                              |
| economy WEEK / QUARTER  | only network-server stats in 15.3                                                                                                                                                                                                                                               |
| real time               | `_autosave_interval` (`TimerGameRealtime`, in `GameLoop`, runs even when paused)                                                                                                                                                                                                |

### 4.8 Pacing, pause, fast-forward

```
VideoDriver::GetGameInterval():                                  // video_driver.hpp
  if paused: return 27 ms
  if _game_speed == 0: return 0                                  // unlimited
  return 27 * 1000 * 100 / _game_speed  microseconds
VideoDriver::GameLoop():                                         // video_driver.cpp
  next_game_tick += GetGameInterval()
  if next_game_tick < now - 5 * GetGameInterval(): next_game_tick = now   // drop backlog
  ::GameLoop()                                                   // one tick
```

- `ChangeGameSpeed(on)` (`gfx.cpp`): `_game_speed = on ? gui.fast_forward_speed_limit : 100`.
  Toolbar button toggles; holding the fast-forward key does it while held
  (`video_driver.cpp:Tick`). Disabled when `_networking`.
- `ToolbarPauseClick` posts `CMD_PAUSE(PauseMode::Normal, !paused)`; `CmdPause` sets/clears the bit.
- While paused, `StateGameLoop` returns early: no date change, no vehicles, no tile loop.
  Drawing and input continue. Commands are still accepted if
  `IsCommandAllowedWhilePaused` (`command.cpp`): type's level `<= construction.command_pause_level`
  with levels `NoActions=0, NoConstruction=1, NoLandscaping=2, AllActions=3` and per type:
  LandscapeConstruction→3, VehicleConstruction→2, MoneyManagement→2,
  Vehicle/Route/OtherManagement→1, CompanySetting/ServerSetting/Cheat→0.

### 4.9 Calendar vs wallclock ("timekeeping units")

- `TKU_CALENDAR = 0` (default): economy date is the calendar date; minutes-per-year is forced
  to 12 (`settings_table.cpp:ChangeTimekeepingUnits`). New game sets both dates to
  `starting_year`-01-01 (`misc.cpp:InitializeGame`).
- `TKU_WALLCLOCK = 1`: economy uses 30-day months and 360-day years (one economy month ≈ 1 real
  minute at 1x, per `gfx_type.h` comment), starting at economy year 1, 01-01. UI shows
  "minutes"/"periods" instead of months/years. Calendar may then be slowed or frozen with
  `minutes_per_calendar_year` (values 1..11 are snapped: 1→12, others→0, `ChangeMinutesPerYear`).
- Setting is `NewgameOnly`.

## 5. Defaults

| Setting                             | Default            | Range / note                                 | ini                  |
| ----------------------------------- | ------------------ | -------------------------------------------- | -------------------- |
| `economy.timekeeping_units`         | `TKU_CALENDAR`     | 0..1, new game only                          | economy_settings.ini |
| `economy.minutes_per_calendar_year` | 12                 | 0..10080; editable only in menu or wallclock | economy_settings.ini |
| `game_creation.starting_year`       | 1950               | 0..5 000 000                                 | world_settings.ini   |
| `game_creation.ending_year`         | 2050               | 0..4 999 999; 0 = never                      | world_settings.ini   |
| `gui.fast_forward_speed_limit`      | 2500 (= 25x)       | 0..50000 step 10; 0 = unlimited; not in save | gui_settings.ini     |
| `gui.pause_on_newgame`              | false              | client setting                               | gui_settings.ini     |
| `gui.autosave_interval`             | 10 (minutes)       | 0..1440, real time                           | gui_settings.ini     |
| `construction.command_pause_level`  | 1 (NoConstruction) | 0..3                                         | world_settings.ini   |

## 6. Stage 1 needs

- Tick constants (27 ms, 74 ticks/day) and `TimerGameTick::counter`.
- Calendar mode only: one date drives both clocks (keep two variables or an alias, but
  economy == calendar). Date ↔ YMD conversion with leap years, start 1950-01-01.
- Timer dispatch with trigger/priority order; per-tick order of §4.3 (tile loop, vehicle
  ticks, station load/unload, station/industry/town ticks, companies).
- Daily/monthly/yearly hooks needed by Stage 1: vehicle economy day proc (running costs),
  company monthly (interest, statistics), yearly expense rotation, station rating ticks,
  industry production cycle, town passenger generation (via tile loop).
- Pause (`PauseMode::Normal` only) and fast-forward via `_game_speed` with the
  `GetGameInterval` formula and the `ALLOWED_DRIFT = 5` catch-up rule.

## 7. Skipped

- Wallclock mode, slowed/frozen calendar (`sub_date_fract`) — not Stage 1; keep the economy
  and calendar variables separate so it can be added.
- `MAX_YEAR` wraparound — unreachable in practice.
- Engine introduction/aging (calendar DAY/MONTH) — depends on engine list scope (see trains.md).
- Inflation (`economy.inflation` default `false`, economy_settings.ini), disasters, subsidies, link graph, AI/game scripts,
  network pause modes, NewGRF 32-day vehicle callback, autosave.

## 8. Open questions

- Browser loop: replicate the video driver exactly (fixed `next_game_tick` += interval,
  reset when more than 5 intervals behind), or cap ticks per animation frame? With
  fast-forward 25x a frame of ~16.7 ms needs ~15 ticks; the source simply runs as fast as the
  interval allows and drops backlog beyond 5 intervals.
- Same-trigger timers with `Priority::NONE` are ordered by pointer address in the source.
  Any fixed order should be equivalent since they must not call `Random()`; confirm the port
  may use registration order.
- `TICKS_PER_SECOND = 1000 / 27` is integer division (37). Confirm no Stage 1 code depends on
  a fractional value.
- Should Stage 1 enforce `command_pause_level = 1` (no building while paused, but vehicle
  start/stop and orders allowed), or allow everything while paused?
- `DateToYear(d) = d / 366` is used to show vehicle age / max age and engine life in years
  (`vehicle_gui.cpp`, `build_vehicle_gui.cpp`) and in conditional orders (`order_cmd.cpp`).
  Should the Stage 1 vehicle window reproduce this approximation (366-day "years")?
