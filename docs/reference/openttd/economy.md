# Economy: money, prices, cargo payment, loan and company finances

Read from OpenTTD 15.3 (`reference/OpenTTD/src`). Paths below are relative to that directory.

## 1. Purpose

The economy subsystem turns game actions into money. It computes the price of everything a company
builds, buys or runs from a fixed table of base prices (scaled by difficulty settings and, when
enabled, by inflation). It pays companies for delivered cargo based on amount, distance and transit
time. It also keeps each company's bank balance, loan, monthly interest, yearly expense table and
quarterly statistics.

## 2. Source files

| File                                                             | Key functions / items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `economy_type.h`                                                 | `Money` typedef, `Economy` struct, `Price` enum, `ExpensesType` enum, `PriceCategory`, `LOAN_INTERVAL`, `INITIAL_LOAN`, `MAX_LOAN_LIMIT`, `MAX_INFLATION`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `economy_func.h`                                                 | Declarations of `GetPrice`, `GetTransportedGoodsIncome`, `AddInflation`, `RecomputePrices`, `InitializeEconomy`; `ScaleByCargoScale` helpers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `economy_base.h`                                                 | `CargoPayment` struct (per-vehicle payment accumulator while at a station)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `table/pricebase.h`                                              | `_price_base_specs[]`: start price, category, NewGRF feature and fallback for each `Price`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `economy.cpp`                                                    | `InitializeEconomy`: sets inflation to 1.0. `StartupEconomy`: interest/inflation rates, pre-start inflation, first `RecomputePrices`. `RecomputePrices`: builds `_price[]`, `max_loan`, `CargoSpec::current_payment`. `AddInflation`: monthly inflation step. `GetPrice`: price × factor with shift. `GetTransportedGoodsIncome`: cargo income formula. `DeliverGoods` / `DeliverGoodsToIndustry`: acceptance and profit for a delivery. `CargoPayment::PayFinalDelivery` / `PayTransfer` / `~CargoPayment`: accumulate and credit income. `CompaniesGenStatistics`: bankruptcy check, infrastructure maintenance, quarterly stats. `CompaniesPayInterest`: monthly interest and the fixed monthly "other" charge. `CompanyCheckBankrupt`: bankruptcy state machine. `CalculateCompanyValue` / `CalculateCompanyAssetValue`: company value. `UpdateCompanyRatingAndValue`: performance score. `HandleEconomyFluctuations`: recessions. Timers `_calendar_inflation_monthly` and `_economy_companies_monthly` |
| `misc_cmd.cpp`                                                   | `CmdIncreaseLoan`, `CmdDecreaseLoan`, `CmdSetCompanyMaxLoan` (game scripts only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `company_cmd.cpp`                                                | `Company::GetMaxLoan`, `GetAvailableMoney`, `CheckCompanyHasMoney`, `SubtractMoneyFromAnyCompany` / `SubtractMoneyFromCompany` / `SubtractMoneyFromCompanyFract`, `DoStartupNewCompany` (starting money), `_economy_companies_yearly` timer (expense table rotation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `company_base.h`                                                 | `CompanyProperties` money fields, `CompanyEconomyEntry`, `CompanyInfrastructure`, `COMPANY_MAX_LOAN_DEFAULT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `company_type.h`                                                 | `MAX_HISTORY_QUARTERS = 24`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `company_gui.cpp`                                                | Finances window grouping of expense types; loan buttons (click = one step, Ctrl+click = max)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `command.cpp`                                                    | Calls `CheckCompanyHasMoney` then `SubtractMoneyFromCompany` for every executed command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `cargotype.h`                                                    | `CargoSpec`: `initial_payment`, `transit_periods[2]`, `current_payment`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `table/cargo_const.h`                                            | `_default_cargo[]`: original cargo constants (passengers, coal, ...)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `cargopacket.h`                                                  | `CargoPacket::GetDistance`, `GetPeriodsInTransit`, `GetFeederShare`, `UpdateLoadingTile` / `UpdateUnloadingTile`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `engine.cpp`                                                     | `Engine::GetCost`, `Engine::GetRunningCost` (vehicle prices from price bases)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `train_cmd.cpp`                                                  | `Train::GetRunningCost`, `Train::OnNewEconomyDay` (daily running-cost charge)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `currency.h` / `currency.cpp`                                    | `CurrencySpec`, `origin_currency_specs` (display-only conversion rates)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `strings.cpp`                                                    | `FormatGenericCurrency`: multiplies by `rate` when formatting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `table/settings/difficulty_settings.ini`, `economy_settings.ini` | Defaults (section 5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## 3. State

### Money

- `Money` = `OverflowSafeInt64` (`economy_type.h`): signed 64-bit integer whose `+ - *` saturate at
  `INT64_MIN` / `INT64_MAX` instead of wrapping. `>>=` is a plain arithmetic shift, which rounds toward
  negative infinity (`core/overflowsafe_type.hpp:operator >>=`).
- Base currency is the **British pound**. Every amount in the simulation is in whole pounds. The
  exceptions are the places that explicitly keep 1/256 fractions (running costs, vehicle profit).

### Global `_economy` (`economy_type.h:Economy`)

| Field                                                       | Type   | Meaning                                                                                 |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `max_loan`                                                  | Money  | Max loan for companies without their own limit. NOSAVE: recomputed in `RecomputePrices` |
| `fluct`                                                     | int16  | Recession counter: `> 0` = normal, `<= 0` = recession (`EconomyIsInRecession`)          |
| `interest_rate`                                             | uint8  | Loan interest in percent per year                                                       |
| `infl_amount`                                               | uint8  | Yearly price inflation in percent                                                       |
| `infl_amount_pr`                                            | uint8  | Yearly cargo-payment inflation in percent                                               |
| `inflation_prices`                                          | uint64 | Cumulative price inflation, fixed point with 16 fractional bits (`1 << 16` = 1.0)       |
| `inflation_payment`                                         | uint64 | Cumulative payment inflation, same format                                               |
| `industry_daily_change_counter`, `industry_daily_increment` | uint32 | Industry production changes (see towns-industries.md)                                   |

Other globals: `_price[PR_END]` (Money, current price of each base, already multiplied by
difficulty and inflation), `_price_base_multiplier[PR_END]` (int8, NewGRF power-of-two modifiers,
all 0 without NewGRF).

### Per cargo (`cargotype.h:CargoSpec`)

- `initial_payment` (int32): payment rate before inflation.
- `transit_periods[2]` (uint8): the two transit-time thresholds, in cargo aging periods.
- `current_payment` (Money): `initial_payment` × payment inflation. Recomputed in `RecomputePrices`.

### Per company (`company_base.h:CompanyProperties`)

| Field                                                  | Type                  | Meaning                                                                                                                     |
| ------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `money`                                                | Money                 | Bank balance, pounds (can go negative)                                                                                      |
| `money_fraction`                                       | uint8                 | 1/256-pound remainder, used by `SubtractMoneyFromCompanyFract`                                                              |
| `current_loan`                                         | Money                 | Amount borrowed                                                                                                             |
| `max_loan`                                             | Money                 | Per-company limit, or `COMPANY_MAX_LOAN_DEFAULT` (= `INT64_MIN`), meaning "use `_economy.max_loan`"                         |
| `yearly_expenses`                                      | `array<Expenses, 3>`  | Index 0 = this year, 1 and 2 = previous years. Each is `array<Money, EXPENSES_END>`. Costs are positive, income is negative |
| `cur_economy`                                          | CompanyEconomyEntry   | This quarter: `income`, `expenses` (≤ 0), `delivered_cargo[]`, `performance_history`, `company_value`                       |
| `old_economy[24]`                                      | CompanyEconomyEntry   | Last `MAX_HISTORY_QUARTERS = 24` quarters; `[0]` = most recent                                                              |
| `num_valid_stat_ent`                                   | uint8                 | Number of valid `old_economy` entries                                                                                       |
| `months_of_bankruptcy`                                 | uint8                 | Consecutive months in "cannot pay" state                                                                                    |
| `bankrupt_asked`, `bankrupt_timeout`, `bankrupt_value` | –                     | Sale-offer state (later stage)                                                                                              |
| `infrastructure`                                       | CompanyInfrastructure | Counts of rail pieces per rail type, signals, station tiles, ... (used for maintenance)                                     |

### `ExpensesType` (`economy_type.h`)

| Value | Name                        | Finances window group (`company_gui.cpp`) |
| ----- | --------------------------- | ----------------------------------------- |
| 0     | `EXPENSES_CONSTRUCTION`     | Capital expenses                          |
| 1     | `EXPENSES_NEW_VEHICLES`     | Capital expenses                          |
| 2     | `EXPENSES_TRAIN_RUN`        | Operating expenses                        |
| 3     | `EXPENSES_ROADVEH_RUN`      | Operating expenses                        |
| 4     | `EXPENSES_AIRCRAFT_RUN`     | Operating expenses                        |
| 5     | `EXPENSES_SHIP_RUN`         | Operating expenses                        |
| 6     | `EXPENSES_PROPERTY`         | Operating expenses                        |
| 7     | `EXPENSES_TRAIN_REVENUE`    | Revenue                                   |
| 8     | `EXPENSES_ROADVEH_REVENUE`  | Revenue                                   |
| 9     | `EXPENSES_AIRCRAFT_REVENUE` | Revenue                                   |
| 10    | `EXPENSES_SHIP_REVENUE`     | Revenue                                   |
| 11    | `EXPENSES_LOAN_INTEREST`    | Operating expenses                        |
| 12    | `EXPENSES_OTHER`            | Capital expenses                          |
| 13    | `EXPENSES_END`              | –                                         |

### Per vehicle at a station (`economy_base.h:CargoPayment`)

`current_station`, `front` (front vehicle), `route_profit` (Money actually credited),
`visual_profit` (profit shown, after subtracting feeder shares), `visual_transfer` (feeder credits shown).

## 4. Rules and formulas

### 4.1 Economy start-up

```
InitializeEconomy():                                   // economy.cpp:InitializeEconomy
  inflation_prices = inflation_payment = 1 << 16       // = 1.0

StartupEconomy():                                      // economy.cpp:StartupEconomy (called from genworld.cpp:_GenerateWorld before map generation)
  interest_rate  = difficulty.initial_interest         // default 2
  infl_amount    = difficulty.initial_interest         // default 2
  infl_amount_pr = max(0, difficulty.initial_interest - 1)   // default 1
  fluct          = GB(Random(), 0, 8) + 168            // 168..423; consumes ONE game Random() call
  if economy.inflation:                                // default false
    months = (min(calendar_year, ORIGINAL_MAX_YEAR=2090) - ORIGINAL_BASE_YEAR=1920) * 12
    repeat months times: AddInflation(check_year=false)
  RecomputePrices()
  StartupIndustryDailyChanges(true)
```

### 4.2 Price bases and `RecomputePrices`

Each `Price` has a `start_price` and a `PriceCategory` in `table/pricebase.h`. Stage 1 entries
(the "default" column is `_price[]` with default settings: Low construction and running costs, no
inflation; computed with the formula below):

| Price                          | start_price | Category     | Default `_price` | Medium |   High |
| ------------------------------ | ----------: | ------------ | ---------------: | -----: | -----: |
| `PR_STATION_VALUE`             |         100 | NONE         |              100 |    100 |    100 |
| `PR_BUILD_RAIL`                |         100 | CONSTRUCTION |               75 |    100 |    112 |
| `PR_BUILD_SIGNALS`             |          65 | CONSTRUCTION |               48 |     65 |     73 |
| `PR_BUILD_DEPOT_TRAIN`         |         600 | CONSTRUCTION |              450 |    600 |    675 |
| `PR_BUILD_STATION_RAIL`        |         200 | CONSTRUCTION |              150 |    200 |    225 |
| `PR_BUILD_STATION_RAIL_LENGTH` |         180 | CONSTRUCTION |              135 |    180 |    202 |
| `PR_BUILD_VEHICLE_TRAIN`       |      400000 | CONSTRUCTION |           300000 | 400000 | 450000 |
| `PR_BUILD_VEHICLE_WAGON`       |        2000 | CONSTRUCTION |             1500 |   2000 |   2250 |
| `PR_CLEAR_GRASS`               |          20 | CONSTRUCTION |               15 |     20 |     22 |
| `PR_CLEAR_ROUGH`               |          40 | CONSTRUCTION |               30 |     40 |     45 |
| `PR_CLEAR_ROCKS`               |         200 | CONSTRUCTION |              150 |    200 |    225 |
| `PR_CLEAR_FIELDS`              |         500 | CONSTRUCTION |              375 |    500 |    562 |
| `PR_CLEAR_TREES`               |          20 | CONSTRUCTION |               15 |     20 |     22 |
| `PR_CLEAR_RAIL`                |         -70 | CONSTRUCTION |              -53 |    -70 |    -79 |
| `PR_CLEAR_SIGNALS`             |          10 | CONSTRUCTION |                7 |     10 |     11 |
| `PR_CLEAR_DEPOT_TRAIN`         |          80 | CONSTRUCTION |               60 |     80 |     90 |
| `PR_CLEAR_STATION_RAIL`        |          50 | CONSTRUCTION |               37 |     50 |     56 |
| `PR_CLEAR_HOUSE`               |        1600 | CONSTRUCTION |             1200 |   1600 |   1800 |
| `PR_CLEAR_ROAD`                |          40 | CONSTRUCTION |               30 |     40 |     45 |
| `PR_BUILD_FOUNDATION`          |         250 | CONSTRUCTION |              187 |    250 |    281 |
| `PR_RUNNING_TRAIN_STEAM`       |        5600 | RUNNING      |             4200 |   5600 |   6300 |
| `PR_RUNNING_TRAIN_DIESEL`      |        5200 | RUNNING      |             3900 |   5200 |   5850 |
| `PR_RUNNING_TRAIN_ELECTRIC`    |        4800 | RUNNING      |             3600 |   4800 |   5400 |
| `PR_INFRASTRUCTURE_RAIL`       |          10 | RUNNING      |                7 |     10 |     11 |
| `PR_INFRASTRUCTURE_STATION`    |         100 | RUNNING      |               75 |    100 |    112 |

A negative price is a refund: removing rail pays the company money. Terraform (`PR_TERRAFORM`, 250)
is not needed. `PR_BUILD_FOUNDATION` only applies on slopes. The `Price` enum order must be kept
because NewGRF multipliers index it.

```
RecomputePrices():                                     // economy.cpp:RecomputePrices
  _economy.max_loan = ((uint64)difficulty.max_loan * inflation_prices >> 16)
                      / LOAN_INTERVAL * LOAN_INTERVAL  // round down to 10000
  for each Price i:
    price = start_price[i]
    mod = 1                                            // PCAT_NONE
    if category == PCAT_RUNNING:      mod = difficulty.vehicle_costs      // default 0
    if category == PCAT_CONSTRUCTION: mod = difficulty.construction_cost  // default 0
    price *= {0: 6, 1: 8, 2: 9}[mod]                   // Low / Medium / High
    price = price * inflation_prices                   // 16 fractional bits
    shift = _price_base_multiplier[i] - 16 - 3         // NewGRF modifier (0), drop fraction, /8
    price = shift >= 0 ? price << shift : price >> -shift   // arithmetic shift (floor)
    if price == 0: price = Clamp(start_price[i], -1, 1)
    _price[i] = price
  for each CargoSpec cs:
    cs.current_payment = (cs.initial_payment * (int64)inflation_payment) >> 16
```

So with no inflation and no NewGRF: Low = ×6/8 = ×0.75, Medium = ×1, High = ×9/8 = ×1.125,
rounded toward −∞ (for example -70 × 0.75 = -52.5 → -53).

`ResetPriceBaseMultipliers()` sets every `_price_base_multiplier` to 0
(`economy.cpp:ResetPriceBaseMultipliers`, called from `newgrf.cpp` on NewGRF reset).
`SetPriceBaseMultiplier(price, factor)` clamps to `[MIN_PRICE_MODIFIER=-8, MAX_PRICE_MODIFIER=16]`.
Without NewGRF the multipliers stay 0.

### 4.3 `GetPrice`

```
GetPrice(index, cost_factor, grf_file, shift = 0):     // economy.cpp:GetPrice
  if index >= PR_END: return 0
  cost = _price[index] * cost_factor
  if grf_file != null: shift += grf_file.price_base_multipliers[index]   // NewGRF only
  return shift >= 0 ? cost << shift : cost >> -shift
```

Vehicle prices use it:

- Purchase: `Engine::GetCost()` = `GetPrice(PR_BUILD_VEHICLE_TRAIN or PR_BUILD_VEHICLE_WAGON, cost_factor, grf, -8)`
  (`engine.cpp:Engine::GetCost`), charged as `EXPENSES_NEW_VEHICLES` (`vehicle_cmd.cpp`).
  For example, the Kirby Paul Tank (`cost_factor` 7, `table/engines.h`) costs 300000×7 >> 8 = **£8,203**.
  A passenger carriage (`cost_factor` 247) costs 1500×247 >> 8 = **£1,447**. A coal truck (176) costs **£1,031**.
- Selling refunds `-front->value` as `EXPENSES_NEW_VEHICLES` (`vehicle_cmd.cpp`). Value depreciation is covered in trains.md.
- Running cost: `Train::GetRunningCost()` = Σ over engines of `GetPrice(running_cost_class, running_cost, grf)`
  **without** the −8 shift, so it is yearly cost × 256. Multiheaded parts use half the factor.
  Wagons have `RC_W = INVALID_PRICE` and cost nothing (`train_cmd.cpp:Train::GetRunningCost`).
  The displayed value is `>> 8` (`vehicle_base.h:GetDisplayRunningCost`).
  Kirby: 4200 × 50 = 210000/256 → **£820/year**.
- Daily charge (`train_cmd.cpp:Train::OnNewEconomyDay`, front engine only, if `running_ticks != 0`):
  ```
  cost = GetRunningCost() * running_ticks / (DAYS_IN_YEAR=365 * DAY_TICKS=74)   // in 1/256 £
  profit_this_year -= cost                                                       // also 1/256 £
  running_ticks = 0
  SubtractMoneyFromCompanyFract(owner, CommandCost(EXPENSES_TRAIN_RUN, cost))
  ```
  `running_ticks` counts ticks where the train is not stopped or still has speed (`Train::Tick`).
- Track helpers (detail in track.md): `RailBuildCost(rt) = _price[PR_BUILD_RAIL] * cost_multiplier >> 3`.
  Normal rail has `cost_multiplier` 8, so it costs £75. `RailClearCost(rt) = max(_price[PR_CLEAR_RAIL], -RailBuildCost(rt)*3/4)`
  gives max(-53, -56) = -53 (`rail.h`).

### 4.4 Inflation

Off by default (`economy.inflation = false`). When on:

```
monthly, on calendar month change:                     // economy.cpp:_calendar_inflation_monthly
  if economy.inflation: AddInflation(); RecomputePrices()

AddInflation(check_year = true):                       // economy.cpp:AddInflation
  if check_year and (calendar_year < 1920 or calendar_year >= 2090): return true   // stops after 2089
  if inflation_prices == MAX_INFLATION or inflation_payment == MAX_INFLATION: return true
  inflation_prices  += (inflation_prices  * infl_amount    * 54) >> 16
  inflation_payment += (inflation_payment * infl_amount_pr * 54) >> 16
  clamp both to MAX_INFLATION = (1 << 31) - 1
  return false
```

The constant 54 approximates `(1+p)^(1/12) - 1` scaled by 65536 per percent. With the default
rates, prices rise by ×1.001648 per month (about 1.99 % per year) and payments by ×1.000824 per month
(about 0.99 % per year). Payment inflation is one point lower than price inflation, so transport
slowly gets less profitable. If inflation were enabled with start year 1950, the 360 pre-start
steps give `inflation_prices` = 118307 (×1.805) and `inflation_payment` = 87946 (×1.342). Then
max_loan = £540,000, the initial loan = £180,000 and passenger `current_payment` = 4274.
With the default (inflation off), both stay at 65536.

### 4.5 Cargo income: `GetTransportedGoodsIncome`

`economy.cpp:GetTransportedGoodsIncome(num_pieces, dist, transit_periods, cargo_type)`:

```
cs = CargoSpec(cargo_type); if !cs.IsValid(): return 0
if cs has ProfitCalc callback: ...NewGRF path, skipped...
MIN_TIME_FACTOR = 31; MAX_TIME_FACTOR = 255; TIME_FACTOR_FRAC_BITS = 4; TIME_FACTOR_FRAC = 16
p1 = cs.transit_periods[0]; p2 = cs.transit_periods[1]
over1 = max(transit_periods - p1, 0)
over2 = max(over1 - p2, 0)
over_max = MIN_TIME_FACTOR - MAX_TIME_FACTOR                    // = -224
if p2 > -over_max (i.e. p2 > 224): over_max += transit_periods - p1
else:                              over_max += 2*(transit_periods - p1) - p2
if over_max > 0:                                               // very slow: asymptotic tail
  time_factor = max(2*31*16*16 / (over_max + 2*16), 1)          // integer division; 1/16 units
  return BigMulS(dist * time_factor * num_pieces, cs.current_payment, 21 + 4)
else:
  time_factor = max(255 - over1 - over2, 31)
  return BigMulS(dist * time_factor * num_pieces, cs.current_payment, 21)

BigMulS(a, b, shift) = (int32)(((int64)a * (int64)b) >> shift)  // economy.cpp:BigMulS
```

The time factor is 255 up to `p1` periods. After that it falls by 1 per period, and by 2 per
period after `p1 + p2`. When it reaches 31 it follows a 1/(x+1) curve toward 1 (the tail is
continuous: at `over_max = 0` it equals 496/16 = 31). Note that `BigMulS` casts the first product
`dist * time_factor * num_pieces` (computed as `uint`) to `int32_t`.

**Inputs at final delivery** (`economy.cpp:CargoPayment::PayFinalDelivery`):

- `dist = cp->GetDistance(current_tile)` (`cargopacket.h:CargoPacket::GetDistance`):
  `min(|travelled.x| + |travelled.y|, DistanceManhattan(source_xy, current_tile))`.
  `source_xy` is the tile where the packet was **first loaded** (`UpdateLoadingTile`).
  `travelled` sums the (unload − load) vectors of each leg in a vehicle.
  `current_tile` is `v->GetCargoTile()` = the tile of the **wagon** being unloaded (`vehicle_base.h`).
  For a simple A→B route this is the Manhattan distance between the wagon's load tile at A and its unload tile at B.
- `transit_periods = cp->GetPeriodsInTransit()`. A packet gains one period every
  `cargo_age_period` ticks while it is in a vehicle (`VehicleCargoList::AgeCargo`, driven from
  `vehicle.cpp:CallVehicleTicks`). The default is `CARGO_AGING_TICKS = 185` ticks = 2.5 days at
  `DAY_TICKS = 74` (`engine.cpp`). Time waiting in a station does not age cargo.

**Cargo constants** (`table/cargo_const.h:_default_cargo`):

| Cargo            | initial_payment | transit_periods[0] | transit_periods[1] |
| ---------------- | --------------: | -----------------: | -----------------: |
| Passengers       |            3185 |                  0 |                 24 |
| Coal             |            5916 |                  7 |                255 |
| Mail (reference) |            4550 |                 20 |                 90 |

**Worked examples** (no inflation, so `current_payment = initial_payment`; 10 days = 740 ticks = 4 periods):

1. **50 passengers, 20 tiles, 10 days (4 periods).** over1 = 4, over2 = 0. Since p2 = 24 ≤ 224,
   over_max = -224 + 2×4 − 24 = −240 → linear branch. time_factor = 255 − 4 − 0 = 251.
   income = (20×251×50 × 3185) >> 21 = 799,435,000 >> 21 = **£381**.
2. **Passengers, same, 40 periods (100 days).** over1 = 40, over2 = 16, tf = 199 → **£302**.
3. **Passengers, 130 periods (325 days).** over_max = −224 + 260 − 24 = 12 > 0 → tail:
   tf = 15872 / (12+32) = 360 (= 22.5). income = (20×360×50×3185) >> 25 = **£34**.
4. **50 t coal, 20 tiles, 4 periods.** over1 = max(4−7, 0) = 0 → tf = 255.
   income = (20×255×50 × 5916) >> 21 = **£719**.
5. **90 t coal (3 trucks × 30 t), 50 tiles, 20 days (8 periods).** over1 = 1, over2 = 0. p2 = 255 > 224,
   so over_max = −224 + 1 → linear. tf = 254. income = (50×254×90 × 5916) >> 21 = **£3,224**.
6. Same coal at 40 periods: tf = 222 → £2,818. At 200 periods: tf = 62 → £787.

### 4.6 Delivery, acceptance and crediting

```
DeliverGoods(num_pieces, cargo, dest_station, distance, periods, company, src):   // economy.cpp:DeliverGoods
  accepted_ind   = DeliverGoodsToIndustry(st, cargo, num_pieces, src industry, company)
  accepted_total = (st.always_accepted has cargo) ? num_pieces : accepted_ind
  if accepted_total > 0: mark GoodsEntry EverAccepted / CurrentMonth / AcceptedBigtick
  company.cur_economy.delivered_cargo[cargo] += accepted_total
  st.town.received[cs.town_acceptance_effect].new_act += accepted_total
  profit = GetTransportedGoodsIncome(accepted_total, distance, periods, cargo)
  if CheckSubsidised(...): profit *= {0: 1.5, 1: 2, 2: 3, 3+: 4}[difficulty.subsidy_multiplier]
  return profit
```

- `DeliverGoodsToIndustry` (`economy.cpp`) walks `st->industries_near`. It skips the source
  industry, industries that do not accept the cargo or temporarily refuse it, and industries with
  another exclusive supplier. It adds up to `0xFFFF - waiting` to each industry's `accepted[].waiting`
  and remembers the industry so its production is triggered after the station loop
  (`TriggerIndustryProduction`; the power station only consumes, see towns-industries.md).
- `always_accepted` is set by houses (and HQ, and industry tiles of industries that do not accept
  the cargo) (`station_base.h`). Passengers delivered to a town station are paid through this bit.
- The delivered amount (`remove`) is taken out of the vehicle (`cargoaction.cpp:CargoDelivery::operator()`),
  but only `accepted_total` of it is paid. Any unaccepted remainder disappears without payment.
- Payment accumulation (`economy.cpp:CargoPayment::PayFinalDelivery`):
  `route_profit += profit; visual_profit += profit - cp->GetFeederShare(count)`.
- **Crediting**: money is added only when the `CargoPayment` is destroyed (`economy.cpp:CargoPayment::~CargoPayment`).
  This happens when the vehicle leaves the station (`vehicle.cpp:Vehicle::LeaveStation`), crashes or is deleted:
  ```
  if visual_profit == 0 and visual_transfer == 0: return
  SubtractMoneyFromCompany(CommandCost(front.GetExpenseType(income=true) /*EXPENSES_TRAIN_REVENUE*/, -route_profit))
  front.profit_this_year += (visual_profit + visual_transfer) << 8      // 1/256 £
  play cash sound; show floating "+£x" text
  ```
  One `CargoPayment` is created per front vehicle in `PrepareUnload` (`economy.cpp`) when it starts loading.
- Feeder (transfer) basics (`economy.cpp:CargoPayment::PayTransfer`): on a transfer unload the
  vehicle gets virtual credit `(GetTransportedGoodsIncome(...) - feeder_share_so_far) * feeder_payment_share / 100`
  (default 75 %). This is stored in the packet's `feeder_share`, not paid. On final delivery the full
  income is paid to the company, and the delivering vehicle's displayed profit is reduced by the
  accumulated feeder share.

### 4.7 Spending money and the expense table

```
command.cpp (every command):  CheckCompanyHasMoney(res); then SubtractMoneyFromCompany(res)

CheckCompanyHasMoney(cost):                            // company_cmd.cpp
  if cost <= 0 or difficulty.infinite_money: ok
  if cost > company.money: error STR_ERROR_NOT_ENOUGH_CASH_REQUIRES_CURRENCY

SubtractMoneyFromAnyCompany(c, cost):                  // company_cmd.cpp
  if cost == 0: return
  c.money -= cost
  c.yearly_expenses[0][cost.type] += cost              // income stored as negative
  if type in {TRAIN,ROADVEH,AIRCRAFT,SHIP}_REVENUE: c.cur_economy.income   -= cost
  elif type in {*_RUN, PROPERTY, LOAN_INTEREST}:     c.cur_economy.expenses -= cost
  // CONSTRUCTION, NEW_VEHICLES, OTHER do not affect cur_economy income/expenses

SubtractMoneyFromCompanyFract(company, cost /*in 1/256 £*/):   // company_cmd.cpp
  m = c.money_fraction
  c.money_fraction = m - (uint8)cost
  cost >>= 8
  if c.money_fraction > m: cost++                      // borrow from whole pounds
  if cost != 0: SubtractMoneyFromAnyCompany(c, CommandCost(type, cost))
```

Yearly rotation (`company_cmd.cpp:_economy_companies_yearly`, on economy year change):
`yearly_expenses` is shifted (`[0]→[1]→[2]`, the old `[2]` is dropped) and `[0]` is zeroed. The finances
window shows these three years in the groups from section 3. The economy timer manager fires all
MONTH timers before YEAR timers (`timer/timer_game_economy.cpp:TimerManager<TimerGameEconomy>::Elapsed`).
So the interest charged on 1 January is booked into the year that is about to be rotated out of `[0]`.

### 4.8 Loan

Constants (`economy_type.h`): `LOAN_INTERVAL = 10000`, `INITIAL_LOAN = 100000`, `MAX_LOAN_LIMIT = 2000000000`.

```
Company::GetMaxLoan():                                 // company_cmd.cpp
  return max_loan == COMPANY_MAX_LOAN_DEFAULT ? _economy.max_loan : max_loan

DoStartupNewCompany:                                   // company_cmd.cpp
  c.money = c.current_loan =
      min((INITIAL_LOAN * inflation_prices >> 16) / LOAN_INTERVAL * LOAN_INTERVAL, _economy.max_loan)
  // default: £100,000 cash, £100,000 loan, max loan £300,000

CmdIncreaseLoan(cmd, amount):                          // misc_cmd.cpp
  max = c.GetMaxLoan()
  if c.current_loan >= max: error STR_ERROR_MAXIMUM_PERMITTED_LOAN
  loan = Interval: LOAN_INTERVAL | Max: max - current_loan
       | Amount: amount (error if < LOAN_INTERVAL, current+amount > max, or amount % LOAN_INTERVAL != 0)
  if c.money > Money::max() - loan: error
  execute: c.money += loan; c.current_loan += loan
  return CommandCost(EXPENSES_OTHER)                   // zero cost; not an expense entry

CmdDecreaseLoan(cmd, amount):                          // misc_cmd.cpp
  if c.current_loan == 0: error STR_ERROR_LOAN_ALREADY_REPAID
  loan = Interval: min(current_loan, LOAN_INTERVAL)
       | Max: max(min(current_loan, GetAvailableMoneyForCommand()), LOAN_INTERVAL); loan -= loan % LOAN_INTERVAL
       | Amount: amount (error if % LOAN_INTERVAL != 0, < LOAN_INTERVAL, or > current_loan)
  if GetAvailableMoneyForCommand() < loan: error STR_ERROR_CURRENCY_REQUIRED
  execute: c.money -= loan; c.current_loan -= loan
```

GUI (`company_gui.cpp`): the "Borrow" button sends `Interval`, Ctrl+click sends `Max`. "Repay" works the same way.
`CmdSetCompanyMaxLoan` is restricted to `OWNER_DEITY` (game scripts), so it is not needed in Stage 1.

### 4.9 Monthly company loop (economy month)

```
_economy_companies_monthly (TimerGameEconomy::MONTH, Priority COMPANY):   // economy.cpp
  CompaniesGenStatistics()
  CompaniesPayInterest()
  HandleEconomyFluctuations()
```

`TimerGameEconomy::month` (0..11) has already moved to the new month when this runs.

**CompaniesGenStatistics** (`economy.cpp`):

1. `CompanyCheckBankrupt(c)` for every company, **every month**. (The function's doc comment says
   "every three months", but the code calls it monthly.)
2. If `economy.infrastructure_maintenance` (default **false**), charge `EXPENSES_PROPERTY`:
   `RailMaintenanceCost` = `(_price[PR_INFRASTRUCTURE_RAIL] * maintenance_multiplier * num * (1 + IntSqrt(total))) >> 11`,
   `SignalMaintenanceCost` = `(_price[PR_INFRASTRUCTURE_RAIL] * 15 * num * (1 + IntSqrt(num))) >> 8` (`rail.h`),
   `StationMaintenanceCost` = `(_price[PR_INFRASTRUCTURE_STATION] * num * (1 + IntSqrt(num))) >> 7` (`station_func.h`),
   plus road, canal and airport. With the default setting there is **no other property charge**:
   `EXPENSES_PROPERTY` is not used anywhere else in 15.3.
3. Only when `month ∈ {0, 3, 6, 9}` (the first month of a quarter): for each company, shift
   `old_economy` by one (keeping 24), `old_economy[0] = cur_economy`, reset `cur_economy`,
   increment `num_valid_stat_ent` (maximum 24), then `UpdateCompanyRatingAndValue(c, true)`.
   That call stores `performance_history` and `company_value = CalculateCompanyValue(c)` into
   `old_economy[0]`.

**CompaniesPayInterest** (`economy.cpp`):

```
yearly_fee = c.current_loan * interest_rate / 100
available = GetAvailableMoney(c)                      // INT64_MAX if infinite_money
if available < 0: yearly_fee += -available * interest_rate / 100    // negative cash also pays interest
up_to_previous = yearly_fee * month / 12
up_to_this     = yearly_fee * (month + 1) / 12
SubtractMoneyFromCompany(CommandCost(EXPENSES_LOAN_INTEREST, up_to_this - up_to_previous))
SubtractMoneyFromCompany(CommandCost(EXPENSES_OTHER, _price[PR_STATION_VALUE] >> 2))   // flat £25/month by default
```

Example: a £100,000 loan at 2 % gives yearly_fee = 2000. The monthly charges are 166, 167, 167, 166, ...
(they sum to exactly 2000 per year), plus £25 "Other" every month.

**HandleEconomyFluctuations** (`economy.cpp`): recessions are off by default (`difficulty.economy = false`).
In that case the function returns immediately unless already in recession (`fluct <= 0`). If it is,
it sets `fluct = -12`, which ends the recession at once (news + `fluct = GB(Random(),0,8) + 312`).
With the setting on, `fluct` decreases monthly. At 0 a recession starts (`fluct = -GB(Random(),0,2)`).
At -12 it ends. Recession effects on production are covered in towns-industries.md.

### 4.10 Negative money and bankruptcy (brief; full flow is a later stage)

- Commands with positive cost fail if `cost > money` (§4.7), so a company with negative money can
  build or buy nothing, and `CmdDecreaseLoan` fails (available money < amount). Selling (negative
  cost) still works. Running costs, interest and the £25 charge still apply, so the balance can keep
  going down.
- Negative cash pays interest like a loan (§4.9).
- `CompanyCheckBankrupt` (`economy.cpp`): if `infinite_money`, skip. The company is fine if
  `money - current_loan >= -GetMaxLoan()`: then `months_of_bankruptcy = 0` and return. Otherwise
  `months_of_bankruptcy++`. Month 4: "company in trouble" news. Month 7: offered for sale with
  `bankrupt_value = CalculateCompanyValue(c, false)`. Month ≥ 10: the company is deleted via
  `CMD_COMPANY_CTRL CCA_DELETE`. In single player, the local company is **never** deleted
  (`bankrupt_asked` is set to all and play continues).

### 4.11 Company value (brief)

```
CalculateCompanyAssetValue(c):                         // economy.cpp
  value = (Σ over c's stations of facilities.Count()) * _price[PR_STATION_VALUE] * 25
        + Σ over every vehicle part owned (train/road/normal aircraft/ship) of (v.value * 3 >> 1)
CalculateCompanyValue(c, including_loan = true):
  value = asset value - (including_loan ? current_loan : 0) + money; return max(value, 1)
```

`UpdateCompanyRatingAndValue` (performance score from `_score_info`, scaled to `SCORE_MAX = 1000`) runs quarterly.
It only feeds the HQ appearance and the graphs.

### 4.12 Currency display (brief)

Money is always simulated in pounds. When formatting, `FormatGenericCurrency` multiplies the value
by `CurrencySpec::rate` (`strings.cpp`) and adds the prefix/suffix and separator. The rate is a
`uint16` integer per currency (`currency.cpp:origin_currency_specs`): GBP 1, USD 2, EUR 2, JPY 220,
and so on. Large values are compacted (k/M/G) when `compact` is set. `locale.currency` defaults to
0 = GBP (`table/settings/locale_settings.ini`). The setting is not network-synced, so it is purely a
display choice. Some currencies switch to EUR in their `to_euro` year (`currency.cpp`).

## 5. Defaults

From `table/settings/difficulty_settings.ini` and `table/settings/economy_settings.ini`:

| Setting                                    | Default                 | Range                                                                    | Effect here                                                  |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `difficulty.max_loan`                      | 300000                  | 10000 .. 2,000,000,000, step 10000 (rounded to nearest step in `pre_cb`) | `_economy.max_loan`                                          |
| `difficulty.initial_interest`              | 2 (%)                   | 2 .. 4                                                                   | `interest_rate`, `infl_amount`; `infl_amount_pr` = value − 1 |
| `difficulty.construction_cost`             | 0 = Low                 | 0 Low, 1 Medium, 2 High                                                  | ×6, ×8 or ×9 (then /8) on CONSTRUCTION prices                |
| `difficulty.vehicle_costs` (running costs) | 0 = Low                 | 0 .. 2                                                                   | Same multipliers on RUNNING prices                           |
| `difficulty.subsidy_multiplier`            | 2 (= ×3)                | 0 .. 3                                                                   | Subsidised delivery bonus (not Stage 1)                      |
| `difficulty.economy` (recessions)          | false                   | –                                                                        | `HandleEconomyFluctuations`                                  |
| `difficulty.infinite_money`                | false                   | –                                                                        | Disables money checks, bankruptcy and negative-cash interest |
| `economy.inflation`                        | **false**               | –                                                                        | No `AddInflation`; both inflation factors stay 1.0           |
| `economy.infrastructure_maintenance`       | **false**               | –                                                                        | No `EXPENSES_PROPERTY` charges                               |
| `economy.feeder_payment_share`             | 75 (%)                  | 0 .. 100                                                                 | Transfer credit                                              |
| `economy.give_money`                       | true                    | –                                                                        | `CmdGiveMoney` (multiplayer, not Stage 1)                    |
| `economy.timekeeping_units`                | calendar                | –                                                                        | Economy and calendar months coincide (see time.md)           |
| `game_creation.starting_year`              | 1950 (`DEF_START_YEAR`) | –                                                                        | Only matters if inflation is on                              |
| `locale.currency`                          | 0 (GBP)                 | –                                                                        | Display only                                                 |

Resulting new-game numbers: cash **£100,000**, loan **£100,000**, max loan **£300,000**, interest
**2 %/year**, all prices = start price × 0.75 (`PR_STATION_VALUE` × 1), `current_payment = initial_payment`.

## 6. Stage 1 needs

1. A `Money` representation with int64 semantics: saturating add/sub/mul and arithmetic `>>`
   (floor). Many products exceed 2^31, for example `dist*tf*n*payment` ≈ 8×10^8 to 10^12.
2. `_price[]` table built by `RecomputePrices` from the Stage 1 subset of `_price_base_specs`
   (keep the full enum order for later NewGRF use), with the Low/Medium/High multipliers and the
   inflation factor kept as fixed-point 1<<16 (even though it stays 1.0 by default).
3. `GetPrice(index, factor, shift)` without the NewGRF term; engine cost/running cost via it.
4. `GetTransportedGoodsIncome` exactly as in §4.5, including the tail branch and `BigMulS`.
5. `DeliverGoods` (acceptance through industry and `always_accepted`, `delivered_cargo` stats; no
   subsidies), `CargoPayment` accumulation and crediting on `LeaveStation`, with
   `EXPENSES_TRAIN_REVENUE` and `profit_this_year`.
6. Company money fields, `SubtractMoneyFromCompany`, `SubtractMoneyFromCompanyFract` with
   `money_fraction`, `CheckCompanyHasMoney` in the command path.
7. Starting money/loan, `CmdIncreaseLoan` / `CmdDecreaseLoan` (Interval and Max; Amount optional).
8. Monthly loop: interest (incl. negative cash), the £25 `EXPENSES_OTHER` charge, quarterly
   `cur_economy` → `old_economy` shift and company value. Yearly `yearly_expenses` rotation and a
   finances view with the three groups.
9. Daily train running cost (`Train::OnNewEconomyDay` charge part).
10. `StartupEconomy`'s `Random()` call for `fluct`, if RNG-sequence parity with OpenTTD matters (see §8).
11. Display in pounds (GBP, rate 1); the currency choice can wait.

## 7. Skipped

- **Inflation**: off by default. Keep the fixed-point factors, but `AddInflation` and the monthly
  timer can be added later (the code is small and fully described in §4.4).
- **NewGRF**: `_price_base_multiplier` / `SetPriceBaseMultiplier` (Action 0 price modifiers, `newgrf.cpp`),
  per-GRF `price_base_multipliers` in `GetPrice`, `CBID_CARGO_PROFIT_CALC` in `GetTransportedGoodsIncome`,
  engine property overrides of cost/running-cost factors (`GetEngineProperty`), the `fallback_price` column
  of `pricebase.h`, and custom cargo aging periods.
- **Subsidies** (`CheckSubsidised`, `subsidy_multiplier`) and **cargo monitors** (`AddCargoDelivery`): later stages.
- **Transfers / feeder shares** beyond the basics: Stage 1 orders have no transfer.
- **Infrastructure maintenance**: off by default.
- **Bankruptcy flow**, company sale/merger (`CmdBuyCompany`, `CalculateHostileTakeoverValue`),
  `CmdGiveMoney`, `CmdSetCompanyMaxLoan`: no AI and no multiplayer in Stage 1.
- **Recessions** (`difficulty.economy` off) and the performance rating details (`_score_info`):
  later; the rating only affects HQ graphics and graphs.
- **Currency conversion, euro switch, custom currency**: display only.
- Road vehicles, ships and aircraft prices: not in Stage 1.

## 8. Open questions

1. **RNG parity**: `StartupEconomy` consumes one `Random()` (for `fluct`) right after the generation
   seed is set and before map generation. Does the port aim for the same random sequence as OpenTTD
   (then this call must be kept, in the same order), or is that not a goal?
2. **Money type in TypeScript**: use `bigint` (exact int64 and saturation) or `number` (safe up to
   2^53, with saturation and floor-shift emulated)? The source needs int64 math; the choice is ours.
3. **`BigMulS` int32 cast**: `dist * time_factor * num_pieces` is cast to `int32_t` before the 64-bit
   multiply. It would overflow for `dist × num_pieces > 8,421,504` (for example 1,000 tiles × 8,422 units
   in one packet). Should the port reproduce that truncation, or treat it as unreachable in Stage 1?
4. **Per-wagon distance**: the distance uses each wagon's own tile at load and unload (`GetCargoTile`),
   so wagons of one train can earn slightly different distances. Should Stage 1 copy this exactly,
   or use one tile per train (simpler, but income would differ by a few tiles)?
5. **Economy vs calendar month timers**: inflation runs on the calendar month, while interest/stats
   run on the economy month. With the default `timekeeping_units = calendar` they fire on the same day.
   Within one month change, is the relative order of the calendar and economy timers defined
   anywhere (it matters only if inflation is on)? To be settled in time.md.
6. **Interest booking at year end**: interest for January is charged on 1 January before the
   yearly rotation, so it lands in the previous year's column (§4.7). This is what the code does,
   and the port should copy it unless we decide otherwise. Confirm that this is intended.
7. **The flat £25/month `EXPENSES_OTHER` charge** (`_price[PR_STATION_VALUE] >> 2` in
   `CompaniesPayInterest`) has no comment in the source explaining its purpose. The behaviour is
   clear and will be ported as is. Should the UI name it anything beyond "Other"?
