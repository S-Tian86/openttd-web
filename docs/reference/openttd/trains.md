# Trains: consist, movement, acceleration, depots

Source: OpenTTD 15.3, `reference/OpenTTD/src`. All paths below are relative to that directory.

## 1. Purpose

A train is a linked list of `Train` vehicle parts: a front engine followed by wagons (and,
for some engines, articulated parts or a rear head). The front engine runs the train every
tick. It updates speed, moves every part one sub-tile step at a time along the track,
picks a track at junctions, reverses at line ends, stops at stations, enters and leaves
depots and pays its running cost once per economy day. Trains are built, joined and sold
only while stopped inside a depot.

## 2. Source files

| File                               | Key functions (one line each)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `train.h`                          | `struct Train` (rail fields, `TrainCache`), inline `GetPower`, `GetWeight`, `GetTractiveEffort`, `GetAirDrag(Area)`, `GetRollingFriction`, `GetAccelerationStatus`, `CalcNextVehicleOffset`                                                                                                                                                                                                                                                                                                                                       |
| `ground_vehicle.hpp`               | `GroundVehicleCache`, `DoUpdateSpeed` (speed/subspeed/progress update), slope Z helpers                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ground_vehicle.cpp`               | `PowerChanged` (power, max TE, air drag), `CargoChanged` (weight, axle resistance), `GetAcceleration` (realistic model), `IsChainInDepot`                                                                                                                                                                                                                                                                                                                                                                                         |
| `vehicle_base.h`                   | common `Vehicle` fields; `GetAdvanceSpeed`, `GetAdvanceDistance`, `IsStoppedInDepot`; `TILE_AXIAL_DISTANCE`, `TILE_CORNER_DISTANCE`                                                                                                                                                                                                                                                                                                                                                                                               |
| `vehicle.cpp`                      | `GetNewVehiclePos` (one step), `CallVehicleTicks`, `RunEconomyVehicleDayProc`, `VehicleEnterDepot`, `VehicleServiceInDepot`, `NeedsServicing`, `DecreaseVehicleValue`, `AgeVehicle`, `Vehicle::Crash`                                                                                                                                                                                                                                                                                                                             |
| `vehicle_cmd.cpp`                  | `CmdBuildVehicle` (price, unit number), `CmdSellVehicle`, `CmdStartStopVehicle`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `train_cmd.cpp`                    | `CmdBuildRailVehicle`, `CmdBuildRailWagon`, `CmdMoveRailVehicle`, `CmdSellRailWagon`, `Train::ConsistChanged`, `GetCurveSpeedLimit`, `GetCurrentMaxSpeed`, `UpdateAcceleration`, `UpdateSpeed`, `TrainLocoHandler`, `TrainController`, `TrainCheckIfLineEnds`, `TrainApproachingLineEnd`, `ReverseTrainDirection`, `CmdReverseTrainDirection`, `ChooseTrainTrack`, `CheckTrainStayInDepot`, `CheckTrainCollision`, `HandleCrashedTrain`, `Train::GetRunningCost`, `Train::Tick`, `Train::OnNewEconomyDay`, `GetTrainStopLocation` |
| `rail_cmd.cpp`                     | `VehicleEnter_Track` (depot enter/leave points), `TicksToLeaveDepot`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `station_cmd.cpp`                  | `VehicleEnter_Station` (braking to and detecting the stop point)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `engine.cpp`                       | `Engine::Engine`, `StartupOneEngine` (intro date randomisation), `GetCost`, `GetRunningCost`, `DetermineCapacity`, `IsEngineBuildable`                                                                                                                                                                                                                                                                                                                                                                                            |
| `table/engines.h`                  | `_orig_engine_info` (`MT`/`MW` dates, life), `_orig_rail_vehicle_info` (`RVI` stats)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `table/pricebase.h`, `economy.cpp` | base prices; `RecomputePrices`, `GetPrice`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `signal.cpp`                       | `UpdateSignalsOnSegment` (block occupancy, used even without signals when leaving a depot)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pathfinder/yapf/yapf_rail.cpp`    | `YapfTrainChooseTrack`, `YapfTrainCheckReverse`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 3. State

Units: speed in km-ish/h (`1 unit = 1/1.6 mph`, `engine_type.h:RailVehicleInfo::max_speed`);
world coordinates in 1/16 tile (`TILE_SIZE = 16`, `tile_type.h`); weight in tonnes; power in hp.

Per part (`vehicle_base.h:Vehicle`, `train.h:Train`):

| Field                              | Type                    | Meaning                                                                                               |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `x_pos`, `y_pos`, `z_pos`          | int32                   | world position of the part's centre; `tile = TileVirtXY(x,y) = (y>>4)*MapSizeX + (x>>4)`              |
| `tile`                             | TileIndex               | current tile                                                                                          |
| `direction`                        | Direction (0..7)        | `N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7` (`direction_type.h`)                                     |
| `track`                            | TrackBits               | one track bit, or `TRACK_BIT_DEPOT = 0x80`, `TRACK_BIT_WORMHOLE = 0x40`                               |
| `cur_speed`                        | uint16                  | current speed (meaningful on the front engine)                                                        |
| `subspeed`                         | uint8                   | fractional speed, 1/256 of a unit                                                                     |
| `progress`                         | uint8                   | leftover movement points carried to the next update                                                   |
| `acceleration`                     | uint8                   | original-model acceleration, `UpdateAcceleration`                                                     |
| `engine_type`                      | EngineID                | index into the engine tables                                                                          |
| `cargo_type`, `cargo_cap`, `cargo` | CargoType, uint16, list | carried cargo; see stations-cargo.md                                                                  |
| `subtype`                          | bits                    | `GVSF_FRONT=0, ARTICULATED_PART=1, WAGON=2, ENGINE=3, FREE_WAGON=4, MULTIHEADED=5` (`vehicle_base.h`) |
| `vehstatus`                        | bits                    | `Hidden=0, Stopped=1, TrainSlowing=4, Crashed=7` (others unused here)                                 |
| `flags` (Train)                    | bits                    | `Reversing=0, PoweredWagon=3, Flipped=4, Reversed=7, Stuck=8, LeavingStation=9`                       |
| `wait_counter`                     | uint16                  | ticks waiting in depot / stuck                                                                        |
| `force_proceed`                    | enum                    | `TFP_NONE=0, TFP_STUCK=1, TFP_SIGNAL=2`                                                               |
| `value`                            | Money                   | resale value                                                                                          |
| `running_ticks`                    | uint8                   | ticks moving or started since last economy day                                                        |
| `day_counter`, `tick_counter`      | uint8                   | wrap counters                                                                                         |
| `unitnumber`                       | UnitID                  | train number (front engines only; wagons get 0)                                                       |
| `crash_anim_pos`                   | uint16                  | crash animation counter                                                                               |

Caches (there is no `ccache`; the caches are `vcache`, `gcache`, `tcache`). Values are valid on the
front part unless noted:

| Cache field                            | Set by                              | Meaning                                                                                    |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `vcache.cached_max_speed`              | `ConsistChanged`                    | min non-zero `max_speed` of all parts (`UINT16_MAX` if none)                               |
| `gcache.cached_veh_length` (each part) | `ConsistChanged`                    | `8 - shorten_factor`; 8 for all original vehicles (`VEHICLE_LENGTH = 8`, `vehicle_type.h`) |
| `gcache.cached_total_length`           | `ConsistChanged`                    | sum of part lengths                                                                        |
| `gcache.cached_weight`                 | `CargoChanged`                      | `max(1, Σ GetWeight())` tonnes                                                             |
| `gcache.cached_axle_resistance`        | `CargoChanged`                      | `10 * weight` N                                                                            |
| `gcache.cached_power`                  | `PowerChanged`                      | `Σ power` hp of powered parts                                                              |
| `gcache.cached_max_te`                 | `PowerChanged`                      | max tractive effort, N                                                                     |
| `gcache.cached_air_drag`               | `PowerChanged`                      | air drag coefficient                                                                       |
| `gcache.cached_max_track_speed`        | `PowerChanged`                      | `min(cached_max_speed, railtype max_speed if > 0)`                                         |
| `tcache.cached_max_curve_speed`        | `ConsistChanged`, `TrainController` | curve limit (realistic only)                                                               |

## 4. Rules and formulas

### 4.1 Consist building

**Buy an engine** (`vehicle_cmd.cpp:CmdBuildVehicle` → `train_cmd.cpp:CmdBuildRailVehicle`):

```
require depot tile owned by company; IsEngineBuildable(eid)     // engine.cpp:IsEngineBuildable
cost = Engine::GetCost()                                        // see 4.8
require power on depot railtype; unit_num = GetFreeUnitNumber (limit max_trains)
dir = depot exit direction; x = tileX*16 + _vehicle_initial_x_fract[dir]; y = tileY*16 + _vehicle_initial_y_fract[dir]
  _vehicle_initial_x_fract = {10, 8, 4, 8}, _vehicle_initial_y_fract = {8, 4, 8, 10}   (index DIAGDIR NE,SE,SW,NW)
direction = DiagDirToDir(dir); track = TRACK_BIT_DEPOT; vehstatus = {Hidden, Stopped}
cargo_type = engine default; cargo_cap = rvi.capacity; reliability, max_age = lifelength*366 days
service_interval = company servint_trains; SetFrontEngine(); SetEngine()
multihead -> AddRearEngineToMultiheadedTrain; ConsistChanged(CCF_ARRANGE)
v.value = cost  (set in CmdBuildVehicle after the build)
if use_free_vehicles: NormalizeTrainVehInDepot -> move every free wagon chain in the depot behind it
```

**Buy a wagon** (`train_cmd.cpp:CmdBuildRailWagon`): same placement, `vehstatus = {Hidden}`
(not Stopped), `SetWagon(); SetFreeWagon()`, cost `Engine::GetCost()` with wagon base price.
It joins an existing free wagon chain of the same engine type in the depot if one exists. The
GUI callback (`train_gui.cpp:CcBuildWagon`) then moves it behind the last part of the only
stopped front engine in the depot (`CMD_MOVE_RAIL_VEHICLE src=new, dest=loco.Last()`).

**Move parts** (`train_cmd.cpp:CmdMoveRailVehicle(src, dest, move_chain)`): both chains must
be `IsStoppedInDepot()` on the same tile; `dest = Invalid` makes a new chain. After
re-linking, `NormaliseSubtypes` marks the new head as front engine (if engine) or free wagon,
`CheckTrainAttachment` rejects lengths over the limit:

```
allowed_len = max_train_length * 16 - head.len - Σ other part lengths;  allowed_len < 0 -> "train too long"
```

With defaults (`max_train_length = 7`, length 8 each) that is 14 parts. Moving the front engine
away hands the orders and unit number to a new engine head (`CopyVehicleConfigAndStatistics`).
`NormaliseTrainHead` calls `ConsistChanged(CCF_ARRANGE)` and gives a unit number if missing.

**Sell** (`vehicle_cmd.cpp:CmdSellVehicle` → `train_cmd.cpp:CmdSellRailWagon`): requires front
`IsStoppedInDepot()` and not crashed. Refund `= -Σ part.value` over the sold chain
(`sell_chain=false`: just that unit; `true`: it and everything behind). Selling a front engine
alone passes orders to the next engine if there is one.

**Value decay** (`vehicle.cpp:DecreaseVehicleValue`, called from `Train::OnNewEconomyDay` when
`(++day_counter & 7) == 0`): `value -= value >> 8`.

**ConsistChanged** (`train_cmd.cpp:Train::ConsistChanged`) recomputes, in order: railtypes and
compatible railtypes, powered-wagon flag (never set for original vehicles: `pow_wag_power = 0`),
`cached_max_speed = min(non-zero max_speed)` over non-articulated parts (wagons counted only
if `wagon_speed_limits`; original wagons have `max_speed = 0`), capacities, lengths, tilt and
curve modifier, `cached_max_curve_speed = GetCurveSpeedLimit()`, then `CargoChanged()` (which
calls `PowerChanged()`) and `UpdateAcceleration()`.

### 4.2 Weight, power, tractive effort, drag

```
part.GetWeight = cargoWeight + rvi.weight          // train.h:Train::GetWeight
cargoWeight = n * cs.weight / 16 (integer), n *= freight_trains if cargo is freight  // cargotype.cpp:WeightOfNUnitsInTrain
   passengers: weight 1  (1/16 t each); coal: weight 16 (1 t each)   // table/cargo_const.h
part.GetPower = rvi.power if not articulated and railtype has power (halved for multihead)  // train.h:GetPower

CargoChanged:  cached_weight = max(1, Σ weight); cached_axle_resistance = 10 * Σ weight
               cached_slope_resistance(part) = weight * train_slope_steepness * 100      // ground_vehicle.cpp
PowerChanged:  cached_power = Σ power
               max_te = Σ_{power>0} weight * tractive_effort; max_te = max_te * 9800 / 256  // GROUND_ACCELERATION = 9800
               air_drag = rvi.air_drag of FRONT (0 for originals) ->
                  air_drag = (max_speed <= 10) ? 192 : max(2048 / max_speed, 1)   // max_speed = cached_max_speed
               cached_air_drag = air_drag + 3 * air_drag * number_of_parts / 20
               if cached_power == 0: set Stopped
UpdateAcceleration: acceleration = Clamp(power / weight * 4, 1, 255)   // train_cmd.cpp, integer division
```

Original rail vehicles all use `tractive_effort = 76` and `air_drag = 0` (`table/engines.h:RVI`).

### 4.3 Tick structure

`vehicle.cpp:CallVehicleTicks` runs, per game tick: `RunEconomyVehicleDayProc()` (see 4.9),
`LoadUnloadStation` for all stations, then `v->Tick()` for every vehicle.

`train_cmd.cpp:Train::Tick` (front engine only):

```
tick_counter++
if !Stopped or cur_speed > 0: running_ticks++
current_order_time++
TrainLocoHandler(v, mode=false); TrainLocoHandler(v, mode=true)   // two movement updates per tick
```

`train_cmd.cpp:TrainLocoHandler(v, mode)`:

```
if Crashed: return mode ? true : HandleCrashedTrain(v)
if force_proceed != NONE: clear Stuck
if HandleBreakdown(): return                      // Stage 1: no breakdowns
if Reversing flag and cur_speed == 0: ReverseTrainDirection(v)
if Stopped and cur_speed == 0: return
if ProcessOrders(v) and CheckReverseTrain(v): wait_counter=0; cur_speed=0; subspeed=0; ReverseTrainDirection; return
else if LeavingStation: (reserve path only if PBS/reserve_paths) clear LeavingStation
HandleLoading(mode); if current order is LOADING: return          // stations-cargo.md
if CheckTrainStayInDepot(v): return                               // 4.7
(stuck handling, only with path reservation; not reachable in Stage 1)
if order is LEAVESTATION: free order; return
j = UpdateSpeed()                                                 // 4.4
adv = GetAdvanceDistance()
if j >= adv:
    TrainCheckIfLineEnds(v)
    loop: j -= adv; TrainController(v, null); if CheckTrainCollision(v): break
          adv = GetAdvanceDistance(); if j < adv or cur_speed == 0: break
          (pass-through waypoint/via-station order handling)
if progress == 0: progress = j        // leftover kept for next update
```

`CheckReverseTrain` returns false if `line_reverse_mode != 0`, in depot/wormhole, or
`direction` is even (not on a straight axis piece); otherwise `YapfTrainCheckReverse`.

### 4.4 Speed update and the progress mechanism

`train_cmd.cpp:Train::UpdateSpeed`:

```
AM_ORIGINAL (0):  DoUpdateSpeed(acceleration * (status == BRAKE ? -4 : 2), min=0, max=GetCurrentMaxSpeed())
AM_REALISTIC (1): DoUpdateSpeed(GetAcceleration(),  min=(status == BRAKE ? 0 : 2), max=GetCurrentMaxSpeed())
status = BRAKE if Stopped or Reversing or Stuck, else ACCEL     // train.h:GetAccelerationStatus
```

`ground_vehicle.hpp:DoUpdateSpeed(accel, min, max)` (8.8 fixed point, arithmetic shift):

```
spd = subspeed + accel;  subspeed = spd & 0xFF           // two's complement low byte
tempmax = max; if cur_speed > max: tempmax = max(cur_speed - cur_speed/10 - 1, max)
cur_speed = max(min(cur_speed + (spd >> 8), tempmax), min)   // >> is floor for negatives
return cur_speed * 3 / 4 + progress;  progress = 0         // GetAdvanceSpeed(speed) = speed*3/4
```

`vehicle_base.h:GetAdvanceDistance`: `(direction & 1) ? TILE_AXIAL_DISTANCE (192) : TILE_CORNER_DISTANCE*2 (256)`.
Odd directions (NE, SE, SW, NW) run along an axis (track X/Y); even ones (N, E, S, W) are the
diagonal half-tile moves on curve pieces. Each consumed `adv` = one `TrainController` call =
every part moves exactly one step (`vehicle.cpp:GetNewVehiclePos`):

```
_delta_coord x = {-1,-1,-1, 0, 1, 1, 1, 0}, y = {-1, 0, 1, 1, 1, 0,-1,-1}   (index = direction)
```

A straight tile is 16 steps. Example: at 100 km-ish/h one update yields 75 points, two per
tick = 150 points ≈ 0.78 steps/tick, ≈ 20.5 ticks per straight tile.

### 4.5 Realistic acceleration (default)

`ground_vehicle.cpp:GroundVehicle::GetAcceleration` (all integer, int64):

```
speed = cur_speed; mass = cached_weight; power = cached_power * 746        // W
resistance = cached_axle_resistance + mass * (15 * (512 + speed) / 512)    // train.h:GetRollingFriction
           + area * cached_air_drag * speed * speed / 1000                 // area = 14 (28 in tunnel), train.h:GetAirDragArea
           + Σ ±cached_slope_resistance (parts going up/down; 0 on flat land)
max_te = cached_max_te
if speed > 0:  force = power * 18 / (speed * 5); if ACCEL and force > max_te: force = max_te
else:          force = ACCEL ? min(max_te, power) : power
               force = max(force, mass * 8 + resistance)                   // "kickoff"
if ACCEL:  if force == resistance: return 0
           a = (force - resistance) / (mass * 4)
           return force < resistance ? min(-1, a) : max(1, a)
else:      return min(-force - resistance, -10000) / mass
```

(Maglev branch omitted: no rolling/axle resistance, `force = power/25`.) The result is added
to `subspeed`, i.e. units of 1/256 km-ish/h per update.

`train_cmd.cpp:Train::GetCurrentMaxSpeed`:

```
max = (model == ORIGINAL) ? cached_max_track_speed : cached_max_curve_speed
if REALISTIC and on rail station tile where the order stops:
    stop_at = GetTrainStopLocation(...); distance_to_go = station_ahead/16 - (station_length - stop_at)/16
    if distance_to_go > 0:
        st_max = 120; delta_v = cur_speed / (distance_to_go + 1)
        if max > cur_speed - delta_v: st_max = cur_speed - delta_v / 10
        st_max = max(st_max, 25 * distance_to_go); max = min(max, st_max)
for each part: if REALISTIC and part.track == DEPOT: max = min(max, 61); break
               if on bridge middle: max = min(max, bridge speed)
max = min(max, current_order.GetMaxSpeed()); return min(max, cached_max_track_speed)
```

Railtype "Railway" has `max_speed = 0` (no limit), `curve_speed = 0`, acceleration type
`Normal` (`table/railtypes.h`).

**Curve limit** (`train_cmd.cpp:Train::GetCurveSpeedLimit`, returns 65535 in ORIGINAL model):

```
walk consecutive part pairs (u, u.Next), pos += Next.len:
   dirdiff 45° left/right: count it; if a previous 45° bend exists: numcurve++, sum += pos - lastpos,
        if pos - lastpos <= 8 and max > 88: max = 88;   lastpos = pos
   dirdiff 90°: max = 61
if numcurve > 0 and max > 88:
   if exactly one left and one right 45° bend: max = 65535
   else s = ceil(sum / 8) / numcurve; max = 232 - (13 - Clamp(s,1,12))^2
if max != 65535: max += (max/2) * rti.curve_speed; if tilt: max += max/5
                 max += max * curve_speed_mod / 256; max = Clamp(max, 2, 65535)
```

Recomputed in `TrainController` whenever any part changed direction.

### 4.6 Original acceleration (setting value 0)

`acceleration = Clamp(power / weight * 4, 1, 255)`, applied as `+2*acceleration` or
`-4*acceleration` per update (4.4). When the FRONT part changes direction on entering a tile
(`train_cmd.cpp:TrainController`): `cur_speed -= (diff is 45° ? 64 : 128) * cur_speed >> 8`
(`_accel_slowdown = {small_turn 64, large_turn 128, z_up 64, z_down 2}` for normal rail).
Slopes (`AffectSpeedByZChange`): up `cur_speed -= cur_speed*64>>8`; down `+2` if `<= cached_max_track_speed`.

### 4.7 Movement along track (`train_cmd.cpp:TrainController(v, nomove)`)

For each part from `v` to the end:

```
gp = GetNewVehiclePos(part)
if part.track == DEPOT and same tile: stay (gp = current pos)
else if same tile:
    if front: if !TrainCheckIfLineEnds(v): return false     // reversed
    VehicleEnterTile(...): CannotEnter -> invalid_rail; EnteredStation -> TrainEnterStation (BeginLoading)
else (new tile):
    enterdir = DiagdirBetweenTiles(old, new)
    bits = reachable tracks on new tile from enterdir
    if front and forbid_90_deg: bits &= ~TrackCrossesTracks(current track)
    if bits == NONE or !CheckCompatibleRail (owner and railtype): goto invalid_rail
    front:  chosen = ChooseTrainTrack(...); (red-signal handling, Stage 2); TryReserveRailTrack(new, chosen)
    wagon:  chosen = prev.track if prev already on that tile, else _connecting_track[enterdir][exit towards prev]
    (fx, fy, newdir) = _initial_tile_subcoord[track][enterdir]; gp.x = (gp.x & ~0xF) | fx; same for y
    VehicleEnterTile: CannotEnter -> invalid_rail
    if not entered wormhole/depot: if last part: ClearPathReservation(old tile); tile = new; track = chosen
    if newdir != direction: (ORIGINAL front: turn slowdown 4.6); direction = newdir
    EnteredStation -> TrainEnterStation
x_pos, y_pos = gp; update Z (flat in Stage 1)
invalid_rail: if not front -> FatalError("Disconnecting train"); front -> cur_speed = subspeed = 0, ReverseTrainDirection
```

`_initial_tile_subcoord[track][enterdir NE,SE,SW,NW] = {x, y, dir}` (unused combos are 0):

```
X:     {15,8,1}  -         {0,8,5}   -
Y:     -         {8,0,3}   -         {8,15,7}
UPPER: -         {7,0,2}   {0,7,6}   -
LOWER: {15,8,2}  -         -         {8,15,6}
LEFT:  {15,7,0}  {8,0,4}   -         -
RIGHT: -         -         {0,8,4}   {7,15,0}
```

`_connecting_track[enterdir][exitdir]` (rows NE,SE,SW,NW): `{X, LOWER, -, LEFT}, {UPPER, Y, LEFT, -}, {-, RIGHT, X, UPPER}, {RIGHT, -, LOWER, Y}`.

**Junction choice** (`train_cmd.cpp:ChooseTrainTrack`), with `reserve_paths = false` and no
signals: (1) if a track reachable from `enterdir` on the new tile is already reserved, take
it (reservations are written by `TrainController` for tracks under trains even without
signals); (2) if only one track: take it; (3) else `YapfTrainChooseTrack`, which returns the
first track of the best YAPF path to the order destination, or `FindFirstTrack(tracks)` if
YAPF has no answer (`yapf_rail.cpp:YapfTrainChooseTrack`).

**Line ends** (`train_cmd.cpp:TrainCheckIfLineEnds`, front only, not in depot/wormhole):
next tile in exit direction has no reachable compatible track → `TrainApproachingLineEnd`:

```
x = position within tile towards exit (formula per direction in TrainApproachingLineEnd)
if x + (len+1)/2 * (diagonal ? 1 : 2) >= 16: cur_speed = 0; ReverseTrainDirection
else: set TrainSlowing; cur_speed = min(cur_speed, _breakdown_speeds[x & 0xF])
_breakdown_speeds = {225,210,195,180,165,150,135,120,105,90,75,60,45,30,15,15}
```

**Reversing** (`train_cmd.cpp:ReverseTrainDirection`): no-op if the whole train is inside a
depot. `AdvanceWagonsBeforeSwap`, swap parts end-for-end (positions, tracks, directions;
each direction reversed), `AdvanceWagonsAfterSwap` (pulls a wagon out of a depot if needed),
toggle `Reversed`, clear `Reversing`, `ConsistChanged(CCF_TRACK)`.
`CmdReverseTrainDirection`: in REALISTIC with `cur_speed != 0` it sets `Reversing` (brake,
then reverse at 0); otherwise immediate. Leaves the station if loading and the last part is
on another tile.

**Stations** (`station_cmd.cpp:VehicleEnter_Station`, front only, order stops here): when
the centre line is crossed, if `x == stop` → EnteredStation; if `x < stop` → set TrainSlowing,
`cur_speed = min(cur_speed, max(0, (stop - x)*20 - 15))`. `stop` from
`train_cmd.cpp:GetTrainStopLocation` (NearEnd = total length, Middle = `len - (len - total)/2`,
FarEnd = platform length; minus `(front.len + 1)/2`; FarEnd forced if train ≥ platform).

### 4.8 Depots

Entering (`rail_cmd.cpp:VehicleEnter_Track`, `fract = (x&15) + (y&15)<<4`):

```
_fractcoords_behind = {0x8F, 0x08, 0x80, 0xF8}  -> CannotEnter (from behind)
_fractcoords_enter  = {0x8A, 0x48, 0x84, 0xA8}  (index = depot exit dir NE,SE,SW,NW)
moving inwards and fract == enter[dir]: track = DEPOT; Hidden; direction reversed; tile = depot;
     if last part: VehicleEnterDepot(front)
```

`vehicle.cpp:VehicleEnterDepot`: clear depot reservation, `UpdateSignalsOnSegment`,
`wait_counter = 0`, `force_proceed = NONE`, `ConsistChanged`, Hidden, `cur_speed = 0`,
`VehicleServiceInDepot` (date_of_last_service = today, reliability reset, breakdown chance
cut), then the train is always set `Stopped` and restarted at end of tick unless it was
already stopping (`VehicleEnteredDepotThisTick`, autoreplace loop). Depot orders (service,
halt) are handled here; see orders.md.

Leaving (`train_cmd.cpp:CheckTrainStayInDepot`, whole chain in the same depot):

```
if cached_power == 0: Stopped; stay
if force_proceed == NONE:
   if ++wait_counter < 37: stay
   wait_counter = 0
   seg = reserve_paths ? PBS : UpdateSignalsOnSegment(tile, INVALID_DIAGDIR, owner)
   if seg == SIGSEG_FULL or depot reserved: stay
if order is GOTO_DEPOT for this depot: VehicleEnterDepot again; stay
SetDepotReservation; VehicleServiceInDepot; track = (direction & 2) ? Y : X; unhide; cur_speed = 0; UpdateAcceleration
```

`signal.cpp:UpdateSignalsInBuffer` returns SIGSEG_FULL when any train not in a depot is on
the track block reachable from the depot (`IsTrainAndNotInDepot`), or when an exploration
buffer overflows (`SIG_TBD_SIZE = 256` open nodes). **With no signals the whole connected
network is one block: a train waits in its depot while any other train is on that network.**
Following parts leave when the front part reaches `fract_coord_leave = enter[dir] + (len+1)*_deltacoord_leaveoffset[dir]`
(`_deltacoord_leaveoffset x = {-1,0,1,0}, y = {0,1,0,-1}`): next part unhidden, track X/Y.

**Start/stop** (`vehicle_cmd.cpp:CmdStartStopVehicle`): primary vehicle only; error if crashed
or (stopped train with `cached_power == 0`). Flips `Stopped`; trains keep `cur_speed` and
brake (4.4). `IsStoppedInDepot` = `Stopped` and `IsChainInDepot` (front on depot tile with
speed 0, every part `track == DEPOT` on same tile).

**Servicing**: `Train::OnNewEconomyDay` → `CheckIfTrainNeedsService`: if `servint_trains != 0`
and `NeedsAutomaticServicing()`, find depot via `YapfTrainFindNearestDepot` within
`maximum_go_to_depot_penalty` and set a service go-to-depot order. `NeedsServicing` returns
false when `date_of_last_service + service_interval >= today`, and also false when
`no_servicing_if_no_breakdowns` and `vehicle_breakdowns == 0` (unless an autoreplace is
pending) (`vehicle.cpp:Vehicle::NeedsServicing`).

### 4.9 Running cost and purchase price

```
_price[p] = start_price * {0:6, 1:8, 2:9}[difficulty] * inflation_prices(=1<<16 at start) >> 19
     construction_cost for PCAT_CONSTRUCTION, vehicle_costs for PCAT_RUNNING     // economy.cpp:RecomputePrices
GetPrice(p, factor, grf, shift) = _price[p] * factor, shifted by shift          // economy.cpp:GetPrice
Engine::GetCost        = GetPrice(PR_BUILD_VEHICLE_TRAIN or _WAGON, cost_factor, -8)   // engine.cpp
Engine::GetRunningCost = GetPrice(running_cost_class, running_cost, -8)  (yearly, display)
Train::GetRunningCost  = Σ over parts (GetNextVehicle) with class != INVALID_PRICE and factor != 0:
                         GetPrice(class, factor (halved for multihead), 0)      // yearly, in 1/256 money
```

Base prices (`table/pricebase.h`): `PR_BUILD_VEHICLE_TRAIN 400000`, `PR_BUILD_VEHICLE_WAGON 2000`
(PCAT_CONSTRUCTION); `PR_RUNNING_TRAIN_STEAM 5600`, `_DIESEL 5200`, `_ELECTRIC 4800`
(PCAT_RUNNING). Wagons have `running_cost_class = INVALID_PRICE` → no running cost.

Charging (`train_cmd.cpp:Train::OnNewEconomyDay`, front engine, once per economy day):

```
if running_ticks != 0:
    cost = GetRunningCost() * running_ticks / (365 * 74)      // DAYS_IN_YEAR, DAY_TICKS
    profit_this_year -= cost; running_ticks = 0
    SubtractMoneyFromCompanyFract(owner, cost)   // company_cmd.cpp: money_fraction carries the low 8 bits
```

`vehicle.cpp:RunEconomyVehicleDayProc` spreads the daily procs: on each tick it runs
`OnNewEconomyDay` for pool indices `i = date_fract, date_fract + 74, ...`, so each vehicle is
processed once per day at the tick matching `index % 74`. The same day proc also does
`EconomyAgeVehicle`, value decay (4.1), breakdown check, service check, `CheckOrders` and
updates `dest_tile` for station orders. `OnNewCalendarDay` → `AgeVehicle` (age, old-age news).

### 4.10 Collisions between trains

`train_cmd.cpp:CheckTrainCollision(Train *v)` runs after every step of the front part (4.3);
never in depot. For each vehicle `u` from `VehiclesNearTileXY(v.x_pos, v.y_pos, 7)` (candidates
in the world-unit rectangle `x±7, y±7`, `vehicle.cpp:VehiclesNearTileXY::Iterator`):

```
skip if u not a train, u.track == DEPOT, u.owner != v.owner, or u.First() == v
dx = u.x - v.x; dy = u.y - v.y; if ((dx+7) | (dy+7)) & ~15: skip
min_diff = (u.len+1)/2 + (v.len+1)/2 - 1          // 7 for two 8-long parts
if dx*dx + dy*dy > min_diff^2: skip; if |dz| > 5: skip
victims += TrainCrashed(v) + TrainCrashed(u.First())
```

Crashed state is not checked on `u`: running into a wreck crashes the moving train too.
`Train::Crash`: front gets `+2` victims (driver), frees reservations; `Vehicle::Crash` sets
`Stopped`, marks all parts `Crashed`, returns `RandomRange(passengers + 1)`; `crash_anim_pos = 1`.
If victims > 0: news, `ModifyStationRatingAround(tile, owner, -160, 30)` (all goods ratings of
own stations within Manhattan 30), sound. `HandleCrashedTrain` (once per tick): explosion at
state 4, small explosions with chance 1/7 while ≤ 200, random turning every 4 ticks while
≤ 240, and from 4440 deletes the last part every 32 ticks until the train is gone.

So with no signals: trains do not see each other. Two trains meeting head-on or a train
catching up with another both crash as soon as the front of one comes within the distance
above. The depot rule in 4.8 is the only thing keeping a second train off an occupied network.

## 5. Defaults (new game)

| Setting                                                                                                 | Default                               | Source                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `game_creation.starting_year`                                                                           | 1950 (`DEF_START_YEAR`)               | `world_settings.ini`, `timer/timer_game_common.h` |
| `game_creation.landscape`                                                                               | 0 = temperate                         | `world_settings.ini`                              |
| `vehicle.train_acceleration_model`                                                                      | 1 = realistic                         | `game_settings.ini`                               |
| `vehicle.train_slope_steepness`                                                                         | 3 (%)                                 | `game_settings.ini`                               |
| `vehicle.wagon_speed_limits`                                                                            | true                                  | `game_settings.ini`                               |
| `vehicle.freight_trains`                                                                                | 1                                     | `game_settings.ini`                               |
| `vehicle.max_train_length`                                                                              | 7 tiles                               | `game_settings.ini`                               |
| `vehicle.max_trains`                                                                                    | 500                                   | `game_settings.ini`                               |
| `vehicle.never_expire_vehicles`                                                                         | false; `extend_vehicle_life` 0        | `game_settings.ini`                               |
| `difficulty.vehicle_costs` / `construction_cost`                                                        | 0 / 0 (×6/8 of base)                  | `difficulty_settings.ini`                         |
| `difficulty.vehicle_breakdowns`                                                                         | 1 (reduced)                           | `difficulty_settings.ini`                         |
| `difficulty.line_reverse_mode`                                                                          | false (reversing at stations allowed) | `difficulty_settings.ini`                         |
| `order.no_servicing_if_no_breakdowns`                                                                   | true                                  | `game_settings.ini`                               |
| company `vehicle.servint_trains`                                                                        | 150 days; `servint_ispercent` false   | `company_settings.ini`, `order_func.h`            |
| `pf.forbid_90_deg`                                                                                      | true                                  | `pathfinding_settings.ini`                        |
| `pf.reserve_paths`                                                                                      | false                                 | `pathfinding_settings.ini`                        |
| `pf.path_backoff_interval`                                                                              | 20                                    | `pathfinding_settings.ini`                        |
| `pf.reverse_at_signals` false; `wait_oneway_signal` 15; `wait_twoway_signal` 41; `wait_for_pbs_path` 30 | signals only                          | `pathfinding_settings.ini`                        |
| `pf.yapf.maximum_go_to_depot_penalty`                                                                   | 20 × 100 (`YAPF_TILE_LENGTH`)         | `pathfinding_settings.ini`                        |
| `gui.stop_location`                                                                                     | 1 = Middle (new orders)               | `gui_settings.ini`                                |

**Engines at a 1950 temperate start** (`engine.cpp:StartupOneEngine`): `intro_date = base_intro`
if `base_intro <= 1952-01-01` (start year + 2), else `base_intro + (Random() & 0x1FF)` days
(0..511, seeded per base_intro). Available at start if `intro_date <= 1950-01-01`; climate
must include temperate. `base_intro` = days since 1920-01-01 (`MT`/`MW` macros).

| ID  | Name                     | Intro                 | Speed | Power hp | Weight t | Cap.      | cost_factor → price | running_cost (class) → £/yr |
| --- | ------------------------ | --------------------- | ----- | -------- | -------- | --------- | ------------------- | --------------------------- |
| 0   | Kirby Paul Tank (steam)  | 1925-01-01            | 64    | 300      | 47       | 0         | 7 → 8 203           | 50 (steam) → 820            |
| 8   | Chaney 'Jubilee' (steam) | 1934-01-01            | 112   | 1000     | 131      | 0         | 13 → 15 234         | 120 (steam) → 1 968         |
| 9   | Ginzu 'A4' (steam)       | 1935-01-01            | 128   | 1200     | 162      | 0         | 19 → 22 265         | 140 (steam) → 2 296         |
| 10  | SH '8P' (steam)          | 1954-01-01 + 0..511 d | 144   | 1600     | 170      | 0         | 22 → 25 781         | 130 (steam) → 2 132         |
| 27  | Passenger Carriage       | 1925, infinite life   | –     | –        | 25       | 40 pass.  | 247 → 1 447         | none                        |
| 28  | Mail Van                 | 1925                  | –     | –        | 21       | 30 mail   | 228 → 1 335         | none                        |
| 29  | Coal Truck               | 1925                  | –     | –        | 18       | 30 t coal | 176 → 1 031         | none                        |

Prices assume defaults (difficulty 0, no inflation yet): engine `= 300000 * cf >> 8`, wagon
`= 1500 * cf >> 8`, steam running `= 4200 * rc >> 8`. Lifelengths (years): Kirby 15,
Jubilee 21, A4 20, 8P 23, wagons 20. All have `tractive_effort 76`, `air_drag 0`,
`shorten_factor 0` (length 8). Engines with capacity 0 get the first standard cargo as
default cargo type (`newgrf.cpp:CalculateRefitMasks`). Next temperate engines: Manley-Morel
DMU (11, 1956), UU '37' (14, 1959), all randomised. Other temperate rail wagons (oil,
livestock, goods, grain, wood, iron ore, steel, armoured: IDs 30–37) are also available.

## 6. Stage 1 needs

- `Train` part record with the fields in section 3; consist as a linked list with front flag.
- Build engine / wagon in a depot, auto-attach wagon to the single stopped loco, move parts
  (`CmdMoveRailVehicle` length check), sell (refund `value`), value decay every 8 economy days.
- `ConsistChanged` → `CargoChanged` → `PowerChanged` → `UpdateAcceleration` caches.
- Tick: `Train::Tick` with two `TrainLocoHandler` updates; `DoUpdateSpeed` with exact 8.8
  fixed point and floor shifts; progress/advance mechanism (192/256, speed*3/4).
- Realistic acceleration (default) incl. station approach limit, depot 61 limit, curve limit;
  original model optional (open question).
- `TrainController` step logic with `_initial_tile_subcoord`, `_connecting_track`,
  `_delta_coord`, line-end slowdown/reverse, `ReverseTrainDirection` (equal lengths only).
- Junction choice: reserved-track rule + single-track shortcut + a pathfinder towards the
  order destination (YAPF summary; see open question).
- Depot enter/leave points, 37-tick wait, block-occupancy check that keeps trains in depot,
  start/stop command, `VehicleEnterDepot` servicing.
- Station stop point and slowdown (`VehicleEnter_Station`, `GetTrainStopLocation`) hooking
  into `BeginLoading` (stations-cargo.md) and `ProcessOrders` (orders.md).
- Collision detection and crash handling (including wreck removal timing).
- Running cost accrual by `running_ticks` and daily fractional charging; purchase prices.
- Engine availability at start (table above) with the intro randomisation rule.

## 7. Skipped (and why)

- Signals, path reservation (PBS), `force_proceed`, stuck handling, `CheckNextTrainTile`
  look-ahead: no signals in Stage 1. Hooks: red-signal branch in `TrainController`, `seg_state`
  in `CheckTrainStayInDepot`, `TryPathReserve` calls.
- Slopes (`UpdateInclination`, slope resistance, `AffectSpeedByZChange`): flat map; keep
  `GetSlopeResistance` returning 0.
- Bridges/tunnels (`TRACK_BIT_WORMHOLE`, area 28, bridge speed), level crossings, roads.
- Breakdowns (`HandleBreakdown`, `CheckVehicleBreakdown`, `_breakdown_speeds` for breakdowns),
  reliability decay, engine previews/exclusive offers, model retirement, autoreplace/autorenew.
- NewGRF: callbacks, properties, articulated parts, powered wagons, tilt, curve_speed_mod,
  variable lengths (use length 8 everywhere), sounds, visual effects.
- Multiheaded engines (none available in temperate until 1956), refitting (`CmdRefitVehicle`;
  default wagons already carry passengers/coal), electric/monorail/maglev railtypes.
- Unbunching, timetables, group statistics, vehicle news/advice, AI/GS events.

## 8. Open questions

1. Acceleration model: default is realistic (1). Port only realistic, or both models with the setting?
2. Breakdowns are out of Stage 1, but the default `vehicle_breakdowns` is 1 (reduced). Do we
   treat Stage 1 as `vehicle_breakdowns = 0`? With `no_servicing_if_no_breakdowns = true` that
   disables automatic depot servicing entirely (`Vehicle::NeedsServicing`).
3. Without signals, `CheckTrainStayInDepot` needs block occupancy (`UpdateSignalsOnSegment`
   flood fill over connected track, trains not in depots). Port the signal.cpp exploration
   (including the 256-node overflow → FULL behaviour) or a simpler "any train on the connected
   network" flood fill? They differ only on overflow.
4. Pathfinder: YAPF's costs/penalties are not summarised here. Port YAPF rail cost model, or
   use a simpler shortest path for Stage 1? Needs its own note if YAPF is ported.
5. Track reservation bits are written under moving trains even with `reserve_paths = false`
   (`TryReserveRailTrack` / `ClearPathReservation` in `TrainController`), and
   `ChooseTrainTrack` prefers an already reserved reachable track. Should Stage 1 keep these
   bits (exact behaviour on junctions occupied by another train) or drop them?
6. `RunEconomyVehicleDayProc` phases each vehicle by its pool index (`index % 74`). Should the
   port reproduce pool index allocation (reuse of freed IDs) to match the charging tick?
7. Inflation: `inflation_prices` starts at `1 << 16`; whether it then grows depends on the
   economy inflation setting (economy.md). Prices in section 5 are at game start only.
8. `AddRearEngineToMultiheadedTrain` halves `v->value` before `CmdBuildVehicle` sets it, so the
   rear head's value appears to stay 0. Is that the intended split? (Not Stage 1.)
9. `CmdBuildVehicle`'s `use_free_vehicles` flag: which value does the GUI send by default when
   buying an engine? (`build_vehicle_gui.cpp` not read.)
