# Reusing OpenTTD translations

Research spike for task 1.1.12 (#44). OpenTTD 15.3 ships 66 language
files in `src/lang/*.txt`, licensed GPL-2.0-or-later (same as this
project). This note measures whether our UI strings can reuse them.

## Method

`tools/openttd-strings.mjs` (Node, no dependencies):

1. Parses `STR_ID :text` lines of every language file, skipping blank
   lines, `#`/`##` lines and `.case`/gender variants.
2. Strips `{...}` control codes and compares the English text of
   `english.txt` with the values of `src/ui/i18n/en.json`, trimmed and
   case-insensitive.
3. For every language, counts how many of our keys have a non-empty
   translation for at least one matched OpenTTD id.

```
node tools/openttd-strings.mjs <path-to-OpenTTD-src-lang> [path-to-en.json]
```

## Coverage

Our `en.json` has 18 keys. Only **6** match an OpenTTD string. Every
language reaches at most those 6, so the table is nearly flat.

| Language                        | Keys translated (of 18) |
| ------------------------------- | ----------------------- |
| Spanish                         | 6                       |
| Spanish (MX)                    | 6                       |
| French, German, ...             | 6 (58 of the 66 files)  |
| Persian                         | 5                       |
| Marathi                         | 3                       |
| Chuvash, Urdu                   | 2                       |
| Hindi, Ido, Macedonian, Maltese | 1                       |

All 66 files were scanned. Most (including both Spanish files) cover
all 6 matched keys; only a handful of incomplete translations fall
below that.

## Matched keys

| Our key                        | OpenTTD id                                         |
| ------------------------------ | -------------------------------------------------- |
| `hud.date` (Date)              | `STR_SORT_BY_CAPTION_DATE` (also a network column) |
| `hud.settings` (Settings)      | `STR_AI_DEBUG_SETTINGS` (AI debug button)          |
| `settings.title` (Settings)    | `STR_AI_DEBUG_SETTINGS`                            |
| `settings.language` (Language) | `STR_GAME_OPTIONS_LANGUAGE`                        |
| `panel.close` (Close)          | `STR_GOAL_QUESTION_BUTTON_CLOSE`                   |
| `error.notAllowedWhilePaused`  | `STR_ERROR_NOT_ALLOWED_WHILE_PAUSED`               |

Not matched (12): `hud.pause`, `hud.resume`, `hud.speed`,
`hud.speed.normal`, `hud.speed.x2`, `hud.speed.x4`, `hud.speed.fast`,
`hud.money`, `settings.theme`, `language.en`, `language.es`,
`error.themeLoad`.

## Caveats

- Text equality is not semantic equality: `Settings` hits an AI debug
  button, `Date` hits a column caption. Each match would need manual
  review; only about 3 of the 6 are clearly right
  (`settings.language`, `panel.close`, `error.notAllowedWhilePaused`).
- The HUD controls (pause, speed, money) do not exist as plain labels
  in OpenTTD, which uses icons and its own toolbar tooltips.
- Our `language.*` names are endonyms; OpenTTD handles those through
  language-file metadata, not strings.

## Recommendation

Do not reuse now. Only 6 of 18 keys match, and about half of those are
false friends, so most HUD strings do not match. Keep our own `en` and
`es` files.

Revisit with the larger UI of block 1.3 (windows, menus, vehicle and
industry names), where OpenTTD's wording is more likely to line up. If
the match rate is then high, reuse with a generated mapping file (our
key -> OpenTTD id, produced by this script and reviewed by hand) and
GPL-2.0-or-later attribution for the derived strings.
