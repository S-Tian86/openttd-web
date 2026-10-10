# Orders — order types, flags, order lists and how trains follow them

Source: OpenTTD 15.3, `reference/OpenTTD/src`. All paths below are relative to that `src/`.

## 1. Purpose

Each vehicle follows an ordered list of destinations ("go to station X", "go to depot Y"). Each
order carries flags for loading, unloading and non-stop behaviour. A copy of the active order lives in the vehicle
as `current_order` and also records the vehicle's status (heading somewhere, loading, leaving).
Every tick the train controller calls `ProcessOrders` to pick the next destination. Arriving at a station turns
the order into a loading state. Leaving advances the order index.

## 2. Source files

- `order_type.h` — `OrderType`, `OrderLoadType`, `OrderUnloadType`, `OrderNonStopFlag`, `OrderStopLocation`, depot flags, `ModifyOrderFlags`, limits.
- `order_base.h` — `struct Order` (bit packing, getters/setters) and `struct OrderList`.
- `order_cmd.cpp` — `Order::Make*`, `Order::Equals`, `OrderList::InsertOrderAt/DeleteOrderAt`, `CmdInsertOrder`, `InsertOrder`, `CmdDeleteOrder`, `DeleteOrder`, `CmdSkipToOrder`, `CmdModifyOrder`, `UpdateOrderDest`, `ProcessOrders`, `Order::ShouldStopAtStation`, `Order::CanLoadOrUnload`, `Order::CanLeaveWithCargo`, `RemoveOrderFromAllVehicles`.
- `order_func.h` — service-interval constants, function declarations.
- `order_gui.cpp:GetOrderCmdFromTile` — the default order built when the player clicks a tile.
- `vehicle_base.h` / `base_consist.h` — order-related vehicle fields; `IncrementImplicitOrderIndex`, `IncrementRealOrderIndex`, `UpdateRealOrderIndex`.
- `vehicle.cpp` — `Vehicle::BeginLoading`, `Vehicle::LeaveStation`, `Vehicle::HandleLoading`, `VehicleEnterDepot`, `Vehicle::SendToDepot`, `Vehicle::NeedsServicing`.
- `train_cmd.cpp` — `TrainLocoHandler` (calls `ProcessOrders`, `HandleLoading`), `TrainEnterStation`, `Train::GetOrderStationLocation`, `CheckIfTrainNeedsService`, `Train::OnNewEconomyDay`.
- `station_cmd.cpp:VehicleEnter_Station` — decides when a train stops on a platform.
- `economy.cpp:PrepareUnload`, `LoadUnloadVehicle` and `cargopacket.cpp:VehicleCargoList::Stage` — what the load/unload flags do (details in stations-cargo.md).

## 3. State

### Enums (`order_type.h`)

`OrderType` (4 bits): `OT_NOTHING=0, OT_GOTO_STATION=1, OT_GOTO_DEPOT=2, OT_LOADING=3,
OT_LEAVESTATION=4, OT_DUMMY=5, OT_GOTO_WAYPOINT=6, OT_CONDITIONAL=7, OT_IMPLICIT=8`.
`OT_LOADING` and `OT_LEAVESTATION` only exist in `current_order` (vehicle status). They are never in a list.
`OT_DUMMY` is an invalid order, for example one whose station was removed.

| `OrderUnloadType`  | value | GUI meaning                               |
| ------------------ | ----- | ----------------------------------------- |
| `UnloadIfPossible` | 0     | default: deliver what the station accepts |
| `Unload`           | 1     | "Unload all"                              |
| `Transfer`         | 2     | "Transfer"                                |
| `NoUnload`         | 4     | "No unloading"                            |

| `OrderLoadType`  | value | GUI meaning           |
| ---------------- | ----- | --------------------- |
| `LoadIfPossible` | 0     | default               |
| `FullLoad`       | 2     | "Full load all cargo" |
| `FullLoadAny`    | 3     | "Full load any cargo" |
| `NoLoad`         | 4     | "No loading"          |

`OrderNonStopFlag` (bit set, 2 bits): bit 0 `NoIntermediate` ("non-stop": don't stop at stations
passed on the way), bit 1 `NoDestination` ("via": don't stop at the destination itself).
`OrderStopLocation`: `NearEnd=0, Middle=1, FarEnd=2`.
`OrderDepotTypeFlag` (bit set): bit 0 `Service` (only if servicing is needed), bit 1 `PartOfOrders`.
`OrderDepotActionFlag` (bit set): bit 0 `Halt` (stop in depot), bit 1 `NearestDepot`, bit 2 `Unbunch`.
`OrderDepotAction` (the `CmdModifyOrder` argument): `AlwaysGo=0, Service=1, Stop=2, Unbunch=3`.
`ModifyOrderFlags`: `MOF_NON_STOP=0, MOF_STOP_LOCATION=1, MOF_UNLOAD=2, MOF_LOAD=3, MOF_DEPOT_ACTION=4,
MOF_COND_VARIABLE=5, MOF_COND_COMPARATOR=6, MOF_COND_VALUE=7, MOF_COND_DESTINATION=8`.

Limits: `VehicleOrderID` is `uint8_t`; `INVALID_VEH_ORDER_ID = 0xFF`; `MAX_VEH_ORDER_ID = 254`;
`IMPLICIT_ORDER_ONLY_CAP = 32`. `OrderListID` pool size 64000.

### `struct Order` (`order_base.h`)

| Field                      | Type                     | Contents                                                                                                                                                                                                         |
| -------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                     | uint8                    | bits 0–3 `OrderType`; bits 4–5 `OrderStopLocation`; bits 6–7 `OrderNonStopFlags`; (conditional only: bits 5–7 comparator)                                                                                        |
| `flags`                    | uint8                    | station orders: bits 0–2 unload type, bits 4–6 load type, bit 3 wait-timetabled, bit 7 travel-timetabled. Depot orders: bits 0–2 depot type flags, bits 3–6 depot action flags. Conditional: skip-to order index |
| `dest`                     | `DestinationID` (uint16) | `StationID` or `DepotID`                                                                                                                                                                                         |
| `refit_cargo`              | `CargoType`              | `CARGO_NO_REFIT` by default                                                                                                                                                                                      |
| `wait_time`, `travel_time` | uint16 ticks             | timetable (0 by default)                                                                                                                                                                                         |
| `max_speed`                | uint16                   | `UINT16_MAX` = no limit                                                                                                                                                                                          |

`Order::Equals` compares `type`, `flags` and `dest` (with a special case for nearest-depot orders).
`Order::MakeGoToStation(st)` sets `type = OT_GOTO_STATION` (clearing stop location and non-stop), `flags = 0`, and `dest = st`.
`MakeLoading(ordered)` sets `type = OT_LOADING` and keeps `flags` only if `ordered`. `MakeLeaveStation()` and `MakeDummy()` set `flags = 0`.
`MakeGoToDepot(dest, typeflags, nonstop = {NoIntermediate}, action = {}, cargo = CARGO_NO_REFIT)`.

### `struct OrderList` (`order_base.h`)

`std::vector<Order> orders`, `num_manual_orders` (non-implicit), `num_vehicles`, `first_shared`, and
timetable durations. A list can be shared by several vehicles (`IsShared()` when `num_vehicles > 1`).
`GetNext(cur) = (cur + 1) % GetNumOrders()`.

### Vehicle fields (`vehicle_base.h`, `base_consist.h`)

| Field                                         | Type             | Meaning                                                                   |
| --------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| `orders`                                      | `OrderList*`     | null until the first order is inserted                                    |
| `cur_real_order_index`                        | `VehicleOrderID` | current non-implicit order                                                |
| `cur_implicit_order_index`                    | `VehicleOrderID` | current position including implicit orders                                |
| `current_order`                               | `Order`          | copy of the active order plus status (`OT_LOADING`, `OT_LEAVESTATION`, …) |
| `dest_tile`                                   | `TileIndex`      | destination tile for the pathfinder; 0 = none                             |
| `last_station_visited`                        | `StationID`      | last station stopped at                                                   |
| `last_loading_station`, `last_loading_tick`   |                  | for link-graph statistics                                                 |
| `load_unload_ticks`                           | uint16           | ticks until the next load/unload step                                     |
| `vehicle_flags`                               |                  | `LoadingFinished`, `StopLoading`, `CargoUnloading`, …                     |
| `gv_flags` bit `GVF_SUPPRESS_IMPLICIT_ORDERS` |                  | stop creating implicit orders                                             |

## 4. Rules and formulas

### 4.1 Index advancement (`vehicle_base.h`)

```
SkipToNextRealOrderIndex():
  if num_manual_orders > 0: do { real = (real + 1) % n } while order[real] is OT_IMPLICIT
  else real = 0
IncrementImplicitOrderIndex():
  if implicit == real: SkipToNextRealOrderIndex()
  do { implicit = (implicit + 1) % n } while implicit != real and order[implicit] not OT_IMPLICIT
IncrementRealOrderIndex():
  if implicit == real: IncrementImplicitOrderIndex() else SkipToNextRealOrderIndex()
UpdateRealOrderIndex():
  if real >= n: real = 0
  if num_manual_orders > 0: while order[real] is OT_IMPLICIT: real = (real + 1) % n
  else real = 0
```

Without implicit orders, both indices are always equal and advance together.

### 4.2 `ProcessOrders(v)` (`order_cmd.cpp`)

Called every tick from `train_cmd.cpp:TrainLocoHandler` before `HandleLoading`. Also called from
`CheckNextTrainTile`/look-ahead code and when passing a waypoint or via station.

```
switch current_order.type:
  OT_GOTO_DEPOT: if !PartOfOrders: return false   // manual / service depot visit is not interrupted
  OT_LOADING:    return false
  OT_LEAVESTATION: return false (non-aircraft)
may_reverse = current_order is OT_NOTHING          // true only on the tick after leaving a station
if (current is GOTO_STATION with NoDestination "via" or GOTO_WAYPOINT)
   and v is on an MP_STATION tile whose station == current.dest:
     DeleteUnreachedImplicitOrders; last_station_visited = dest; IncrementImplicitOrderIndex()
UpdateRealOrderIndex()
order = orders[cur_real_order_index]  (null if none or if it is implicit)
if order == null: current_order.Free(); dest_tile = 0; return false   // train drives without a destination
if order.Equals(current_order) and dest_tile != 0: return false       // unchanged
current_order = order
return UpdateOrderDest(v, order) && may_reverse                        // true allows a reverse check
```

`UpdateOrderDest(v, order, depth)`:

```
if depth > num_orders: current_order.Free(); dest_tile = 0; return false
OT_GOTO_STATION: dest_tile = Train::GetOrderStationLocation(dest); return true
OT_GOTO_DEPOT:
   if Service flag and !NeedsServicing(): IncrementRealOrderIndex(); go to next order (recurse)
   if current_order has NearestDepot: FindClosestDepot (skipped in Stage 1)
   else dest_tile = Depot::Get(dest).xy; return true
OT_GOTO_WAYPOINT: dest_tile = waypoint.xy; return true
OT_CONDITIONAL:  jump or IncrementRealOrderIndex; then recurse
default (OT_DUMMY…): dest_tile = 0; return false
recurse: order = orders[cur_real]; current_order = order; return UpdateOrderDest(v, order, depth + 1)
```

`train_cmd.cpp:Train::GetOrderStationLocation(station)`:

```
if station == last_station_visited: last_station_visited = INVALID   // so it may stop there again
if station has no train facility: IncrementRealOrderIndex(); return tile 0
return station.xy
```

### 4.3 Stopping at a station

`Order::ShouldStopAtStation(v, station)` (`order_cmd.cpp`):

```
is_dest = type == OT_GOTO_STATION && dest == station
return (type != OT_GOTO_DEPOT || PartOfOrders)
    && v.last_station_visited != station
    && !nonstop.Test(is_dest ? NoDestination : NoIntermediate)
```

Note: a train with `current_order = OT_NOTHING` (no orders) stops at every station it passes.
`station_cmd.cpp:VehicleEnter_Station` (train, front engine, rail station tile, `ShouldStopAtStation`
true) computes the stop position from `GetTrainStopLocation` (stop location flag, see trains.md /
stations-cargo.md). When the front reaches it, it returns `EnteredStation`. The controller then calls
`train_cmd.cpp:TrainEnterStation(v, station)`: `last_station_visited = station`, first-arrival news, then
`v->BeginLoading()`.

`Vehicle::BeginLoading()` (`vehicle.cpp`):

```
if current_order is OT_GOTO_STATION and current_order.dest == last_station_visited:
    DeleteUnreachedImplicitOrders()
    current_order.MakeLoading(true)                        // keeps load/unload flags of the order
    current_order.SetNonStopType({NoIntermediate, NoDestination})   // marks "this was the destination"
else:
    [insert or skip to an OT_IMPLICIT order for this station; ground vehicles only]
    current_order.MakeLoading(false)                       // flags = 0: load/unload if possible
PrepareUnload(v)                                           // economy.cpp, stages cargo by unload type
cur_speed = 0
```

### 4.4 Loading, leaving and advancing (`vehicle.cpp`, `train_cmd.cpp`)

Each tick `LoadUnloadStation` (`economy.cpp`) counts down `load_unload_ticks` and calls
`LoadUnloadVehicle`, which sets `VehicleFlag::LoadingFinished` (stations-cargo.md). The full-load rules
in `economy.cpp:LoadUnloadVehicle`:

```
finished_loading = true
if current_order.IsFullLoadOrder():
   FullLoadAny: not finished while (cargo_not_full != 0 && (cargo_full & ~cargo_not_full) == 0)
                (i.e. until at least one cargo type of the consist is full)
   FullLoad:    not finished while cargo_not_full != 0  (every cargo type full)
```

`Vehicle::HandleLoading(mode)`:

```
OT_LOADING:
   wait = max(timetabled_wait - lateness_counter, 0)
   if mode (not the first call this tick) or !LoadingFinished or current_order_time < wait: return
   LeaveStation()
   o = orders[cur_implicit_order_index]
   if o == null or (o not IMPLICIT and not GOTO_STATION) or o.dest != last_station_visited: return
   IncrementImplicitOrderIndex()                        // advance only if we stopped at the ordered station
OT_DUMMY: IncrementImplicitOrderIndex()                 // skip invalid orders, one per tick
other: return
```

`Vehicle::LeaveStation()`: delete `cargo_payment` (pays income, economy.md); update
`last_loading_station`; `current_order.MakeLeaveStation()`; return reserved cargo; remove from
`st->loading_vehicles`; trains set `VehicleRailFlag::LeavingStation`.
`TrainLocoHandler`, in the same tick after `HandleLoading`: `if current_order is OT_LEAVESTATION:
current_order.Free(); return`. On the next tick `ProcessOrders` sees `OT_NOTHING`, so `may_reverse = true`,
loads the next order and sets `dest_tile`. If it returns true and `CheckReverseTrain(v)` agrees, the train reverses.

Per-tick order of `train_cmd.cpp:TrainLocoHandler` (orders part only): crashed/stuck handling →
`ProcessOrders` (+ possible reverse) → `HandleLoading` → `return` while `OT_LOADING` →
`CheckTrainStayInDepot` → `OT_LEAVESTATION → Free()` → speed update and movement.

### 4.5 Meaning of the load/unload flags (`cargopacket.cpp:VehicleCargoList::Stage`, `economy.cpp`)

```
force_keep     = unload == NoUnload                 // nothing is unloaded
force_unload   = unload == Unload
force_transfer = unload == Transfer || unload == Unload
per packet: keep if force_keep
            deliver if force_unload && station accepts && packet.first_station != here
            transfer if force_transfer
            otherwise ChooseAction (deliver if accepted, else keep/transfer by cargo flow)
load: skipped when load == NoLoad (LoadUnloadVehicle: `continue`)
```

`Order::CanLoadOrUnload()`: (`GOTO_STATION` or `IMPLICIT`) and not via and not (`NoLoad` and `NoUnload`).
`Order::CanLeaveWithCargo(has_cargo)`: `load != NoLoad || (has_cargo && unload != Unload && unload != Transfer)`.

### 4.6 Depot orders

When a train enters a depot (`vehicle.cpp:VehicleEnterDepot`): it is serviced, `VehicleEnteredDepotThisTick`
**always** sets `VehState::Stopped` and remembers whether to restart it later (it is restarted in
`CallVehicleTicks` unless it was already stopping). Then, if `current_order` is `OT_GOTO_DEPOT`:

```
if PartOfOrders and the real order is not NearestDepot and dest_tile != tile: return   // other depot
(refit if the order has one)
if PartOfOrders: DeleteUnreachedImplicitOrders; IncrementImplicitOrderIndex()
if Halt: do not restart (_vehicles_to_autoreplace[v] = false); last_loading_station = INVALID
current_order.MakeDummy()          // next ProcessOrders picks the next order
```

Manual "send to depot" (`Vehicle::SendToDepot`) sets `current_order = MakeGoToDepot(nearest, {})` (not
part of orders, non-stop), plus `Halt` unless it is a service request. Sending again cancels: if it was
`PartOfOrders` → `IncrementRealOrderIndex`; then `MakeDummy`.
Automatic servicing (`train_cmd.cpp:CheckIfTrainNeedsService`, daily from `Train::OnNewEconomyDay`) sets
`MakeGoToDepot(depot, Service, NoIntermediate, NearestDepot)` when `NeedsAutomaticServicing()`.
`Vehicle::NeedsServicing` returns false when the service interval has not elapsed. After that it returns
true when `!no_servicing_if_no_breakdowns || vehicle_breakdowns != 0`; otherwise it returns true only for a pending autoreplace.

### 4.7 `CmdInsertOrder(flags, veh, sel_ord, new_order)` (`order_cmd.cpp`)

```
v valid and primary; CheckOwnership(v.owner)
refit_cargo == CARGO_NO_REFIT, wait_time == 0, travel_time == 0, max_speed == UINT16_MAX  else CMD_ERROR
OT_GOTO_STATION:
   station exists; if owner != OWNER_NONE: CheckOwnership(station.owner)
   CanVehicleUseStation(v, st) (and every vehicle sharing the list) else STR_ERROR_CAN_T_ADD_ORDER(+reason)
   non-stop flags only for ground vehicles
   load ∈ {LoadIfPossible, NoLoad, FullLoad, FullLoadAny}   (full load refused if the list has an unbunch order)
   unload ∈ {UnloadIfPossible, Unload, Transfer, NoUnload}
   stop location: NearEnd/Middle only for trains; FarEnd for all
OT_GOTO_DEPOT (not NearestDepot): depot exists, CheckOwnership(GetTileOwner(depot.xy)), IsRailDepotTile for trains
   depot type: t = flags; if t has PartOfOrders: t -= Service; t -= PartOfOrders; t must be empty
      => valid: {}, {PartOfOrders}, {PartOfOrders, Service}; Service without PartOfOrders is refused
   actions ⊆ {Halt, NearestDepot, Unbunch}; Service + (Halt|Unbunch) refused; unbunch rules
OT_GOTO_WAYPOINT / OT_CONDITIONAL: (skipped in Stage 1)
other types: CMD_ERROR
if sel_ord > num_orders: CMD_ERROR
if num_orders >= MAX_VEH_ORDER_ID (254): STR_ERROR_TOO_MANY_ORDERS
exec: InsertOrder(v, order, sel_ord)
```

`InsertOrder`: creates the `OrderList` if it is null, otherwise `InsertOrderAt(sel_ord)` (the vector insert;
`sel_ord == num_orders` appends). For each vehicle sharing the list: `if sel_ord <= cur_real_order_index
and cur_real + 1 < n: cur_real++`; the same for `cur_implicit_order_index`. If `sel_ord ==
cur_implicit_order_index`, set `GVF_SUPPRESS_IMPLICIT_ORDERS`. Conditional skip-to targets `>= sel_ord` get +1.
`current_order` is not changed. The next `ProcessOrders` compares it with the order at the (shifted) index.

### 4.8 `CmdDeleteOrder(flags, veh, sel_ord)` / `DeleteOrder`

```
v valid and primary; CheckOwnership
if sel_ord >= num_orders: DecloneOrder (delete all orders of v)     // GUI "delete" with nothing selected
exec DeleteOrder:
  orders.DeleteOrderAt(sel_ord)
  per sharing vehicle u:
    if sel_ord == u.cur_real and u.current_order is OT_LOADING:
        u.current_order.SetNonStopType({})          // "not at an ordered station" marker
        if full load: set load type LoadIfPossible   // so it doesn't wait forever
    if sel_ord < u.cur_real: u.cur_real--  elif ==: u.UpdateRealOrderIndex()
    if sel_ord < u.cur_implicit: u.cur_implicit--  elif ==: wrap to 0 if >= n, skip to next implicit/real
  conditional skip-to targets fixed up
```

### 4.9 `CmdModifyOrder(flags, veh, sel_ord, mof, data)` (essentials)

Allowed `mof` per order type: GOTO_STATION → NON_STOP, STOP_LOCATION, UNLOAD, LOAD; GOTO_DEPOT →
NON_STOP, DEPOT_ACTION; GOTO_WAYPOINT → NON_STOP; CONDITIONAL → COND_*. Other types → CMD_ERROR.
`sel_ord >= num_orders` → CMD_ERROR. Setting a value equal to the current one → CMD_ERROR.

- `MOF_NON_STOP`: ground vehicles only; `data` ⊆ {NoIntermediate, NoDestination}. Setting `NoDestination` (via)
  resets refit, load = LoadIfPossible, and unload = UnloadIfPossible.
- `MOF_STOP_LOCATION`: trains only, `data < 3`.
- `MOF_UNLOAD` / `MOF_LOAD`: refused on via orders; same value sets as insert. `NoLoad` clears refit.
- `MOF_DEPOT_ACTION`: `AlwaysGo` clears Service, Halt, Unbunch; `Service` sets Service and clears Halt/Unbunch;
  `Stop` clears Service and sets Halt; `Unbunch` (only one per list, no conditional/full-load orders).
- After exec, for each sharing vehicle at `cur_real == sel_ord` whose `current_order` is GOTO_STATION
  or LOADING: copy the new load type into `current_order`. So switching off full load releases a waiting train.

`CmdSkipToOrder(flags, veh, sel_ord)`: error if `sel_ord == cur_implicit_order_index`, `sel_ord >= n`,
or `n < 2`. Exec: `LeaveStation()` if loading; `cur_implicit = cur_real = sel_ord`; `UpdateRealOrderIndex()`.

Removing a station or depot (`RemoveOrderFromAllVehicles`): `current_order` heading there → `MakeDummy`. Matching
orders in lists → `MakeDummy` (implicit ones are deleted).

## 5. Defaults

Default station order created by the GUI (`order_gui.cpp:GetOrderCmdFromTile`), for a train clicking an own
(or `OWNER_NONE`) station with a train facility:

```
order.MakeGoToStation(st)                       // load = LoadIfPossible (0), unload = UnloadIfPossible (0)
if Ctrl pressed: load = FullLoadAny
if gui.new_nonstop and ground vehicle: nonstop = {NoIntermediate}
stop location = gui.stop_location (trains)      // other vehicles: FarEnd
```

Default depot order (own rail depot clicked): `MakeGoToDepot(depot, PartOfOrders, new_nonstop ? NoIntermediate : {})`,
no action (= "go to", service always); Ctrl → `Unbunch`. Inserted at `OrderGetSel()` = the selected order,
or `num_orders` (append) when none is selected.

| Setting                               | Default                              | File                                   |
| ------------------------------------- | ------------------------------------ | -------------------------------------- |
| `gui.new_nonstop` (client setting)    | true                                 | `gui_settings.ini`                     |
| `gui.stop_location`                   | 1 = `Middle`                         | `gui_settings.ini`                     |
| `gui.quick_goto`                      | true (GUI only)                      | `gui_settings.ini`                     |
| `order.gradual_loading`               | true                                 | `game_settings.ini`                    |
| `order.improved_load`                 | true                                 | `game_settings.ini`                    |
| `order.no_servicing_if_no_breakdowns` | true                                 | `game_settings.ini`                    |
| `difficulty.vehicle_breakdowns`       | 1 (reduced)                          | `difficulty_settings.ini`              |
| `vehicle.servint_trains` (company)    | 150 (`DEF_SERVINT_DAYS_TRAINS`) days | `company_settings.ini`, `order_func.h` |
| `vehicle.servint_ispercent`           | false                                | `company_settings.ini`                 |

Service interval limits (`order_func.h`): days 30–800, minutes 1–30 (default 5 for trains), percent 5–90
(default 50). A new train starts with `orders = nullptr` and `current_order = OT_NOTHING`.

## 6. Stage 1 needs

- `Order` with type, load type, unload type, non-stop flags, stop location, destination (station or
  depot). The packed bit layout is optional, but the numeric enum values should be kept.
- Per-vehicle order list (sharing can wait), `cur_real_order_index` (implicit index may be the same
  variable if implicit orders are skipped), `current_order`, `dest_tile`, `last_station_visited`.
- `ProcessOrders`/`UpdateOrderDest` for GOTO_STATION and GOTO_DEPOT; `ShouldStopAtStation`;
  `BeginLoading` (ordered branch); `HandleLoading`; `LeaveStation`; the OT_LEAVESTATION → OT_NOTHING
  step and `may_reverse`; `GetOrderStationLocation`.
- Depot order arrival (`VehicleEnterDepot` order part, including Halt) and the `OT_DUMMY` skip.
- Commands: insert (station/depot), delete, modify (load, unload, non-stop, stop location, depot action),
  skip-to. GUI defaults: non-stop on, stop location Middle, Ctrl = full load any.
- Full load / full load any / no load / unload all / transfer / no unload, wired to the loading code in
  stations-cargo.md.

## 7. Skipped

- Implicit orders (`OT_IMPLICIT`, the unordered branch of `BeginLoading`): only created when a train stops
  at a station not in its orders. With `new_nonstop = true` this needs explicit non-non-stop orders. Hook:
  `BeginLoading` else-branch; Stage 1 can just `MakeLoading(false)`.
- Waypoints, via orders, conditional orders, unbunching, refit orders, timetables (`wait_time`,
  `travel_time`, `max_speed`, `UpdateVehicleTimetable`, `lateness_counter`): not in Stage 1.
- Shared/cloned order lists (`CmdCloneOrder`), `CmdMoveOrder`, order backups, `CheckOrders` news warnings.
- Automatic servicing (`CheckIfTrainNeedsService`) and nearest-depot search: servicing is tied to breakdowns.
  Stage 1 has no breakdowns. See open question 1.
- Link-graph statistics (`IncreaseStats`, `LinkRefresher`, `last_loading_station`), PBS look-ahead uses of
  `ProcessOrders`, aircraft/ship/road-vehicle branches.

## 8. Open questions

1. The default `difficulty.vehicle_breakdowns` is 1. With breakdowns on, `NeedsServicing` makes trains
   visit a depot every 150 days. Stage 1 excludes breakdowns. Should Stage 1 behave as if
   `vehicle_breakdowns = 0` (then, with `no_servicing_if_no_breakdowns = true`, no automatic servicing), or
   port servicing visits anyway?
2. `gui.stop_location` default is 1 (`Middle`) in `gui_settings.ini`. Confirm in game that 15.3 really
   defaults new train orders to "middle" of the platform.
3. In `Order`, the depot action bit `Halt` (flags bit 3) and the "wait timetabled" bit (also flags bit 3,
   `IsWaitTimetabled`) overlap for depot orders. Harmless without timetables. Is that intended?
4. `CmdInsertOrder`/`CmdModifyOrder` accept every combination of the valid load and unload values
   (for example "transfer + no load"). Does `order_gui.cpp` disable any combination in the GUI? It was not
   read for this note.
