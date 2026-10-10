# Differences from OpenTTD

Everything listed here differs from OpenTTD 15.3 on purpose. Anything not listed must behave
like OpenTTD; a mismatch is a bug.

| Area                   | OpenTTD           | openttd-web                | Why                                             |
| ---------------------- | ----------------- | -------------------------- | ----------------------------------------------- |
| View                   | Isometric         | Top-down 3/4               | New look; game logic keeps OpenTTD's grid       |
| Graphics, sound, music | Original sets     | Original art, no audio yet | Own art style and themes; no third-party assets |
| NewGRF                 | Supported         | Not supported              | Out of scope (master plan §2.8)                 |
| AI and Game Scripts    | NoAI / GameScript | Not supported              | Out of scope (master plan §2.8)                 |
| Scenario editor        | Yes               | No                         | Out of scope (master plan §2.8)                 |
| Network play           | Yes               | Not yet                    | Needs a backend (master plan §2.9)              |
