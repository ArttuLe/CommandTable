# How to play

Command Table is a tabletop for Commander, played in the browser with friends. It doesn't enforce
any rules. The cards sit on a shared table and you move them the way you would on a kitchen table,
while the app takes care of the bookkeeping: what's hidden from whom, life, mana, commander tax and
damage, and a log of who did what. The rules are the ones you would play by in person.

Setting up a game to host is covered in [playing-with-a-friend.md](playing-with-a-friend.md). This
page is for everyone at the table.

## Joining a game

Whoever is hosting sends you a **link** and a **passphrase**. Open the link, enter your name and
the passphrase, then either:

- **Create room**, if you are the one starting the game. Share the room code from the lobby; the
  copy button beside it puts it on your clipboard.
- **Join room** with the code the host gave you.

If your connection drops or you reload the page, you are put back in your seat on your own. A game
that has started takes no new players, so everyone sits down before the host starts it.

## The lobby

Paste your decklist under **Your deck** and press **Submit deck**. Most export formats work:

```
Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1x Arcane Signet
1 Command Tower (CMR) 350 *F*
```

- Section headers can be `Commander`, `Deck`, `Sideboard` or `Maybeboard`, with or without a colon
  or a count (`Deck (99):`).
- Lines need a count, with or without an `x`. Set codes, collector numbers, foil marks and
  `#tags` are understood and ignored.
- A card that isn't found is listed under **Unresolved cards**, with suggestions for what you may
  have meant. Warnings point out a wrong deck size, duplicate non-basics and cards outside your
  commander's colours. They are advice: nothing stops you playing the deck.

Tick **Ready** when you are. The host starts the game when the table is.

## Opening hands

Everyone is dealt seven. Read your hand (hover a card to see it full size), then:

- **Mulligan** shuffles your hand back and deals seven new cards. The first one is free; after
  that the strip says how many to put on the bottom: right-click each and choose **Bottom**.
- **Keep** settles your hand. The strip above your hand shows who is still deciding.

Nothing in your hand can be played yet. The host presses **Start the game** to begin turn 1. They
can start before everyone has kept, so say so out loud if you are still deciding.

## The table

- **The middle** is the table itself. Every player's board is a mat; yours is bottom left and the
  others go clockwise in turn order. Each mat has its own rows for lands, other permanents and
  creatures, with a rail beside it showing the player's name, life, poison, commander damage, hand,
  library, graveyard and exile counts, and their commander. A glowing mat is the player whose turn
  it is.
- **Moving around:** drag the table to pan, use the scroll wheel to zoom, and press **Fit** (or
  `F`) to see everything. The view fits itself until you move it. Right-click the table for zoom,
  fit, and **Follow the active player**, which glides to whoever's turn it is.
- **The bottom bar** is yours: your life, poison and commander damage, your mana pool, your
  graveyard, exile and library, your hand, and the actions you take every turn.
- **Chat** is on the left edge and the **Log** on the right. Each opens as a rail; while it is
  closed, new lines appear briefly as notes.

## Playing a turn

Hover any card to see it full size. These are the everyday actions; **?** in the top-right corner
lists them all at the table.

| To… | Do this |
|---|---|
| Play a land or cast a spell | Double-click it in your hand. It lands on your battlefield for everyone to see. Once an instant or sorcery has resolved, right-click it and choose **GY**. |
| Tap a land for mana | Click it. What it makes goes into your mana pool, and a land that makes more than one colour asks which. Click it again to untap; that takes the mana back out. |
| Spend mana | Click a colour in your pool to spend one of it. **Add…** adds mana by hand (rituals, treasures, rocks); **Reset** empties the pool. |
| Draw | **Draw**, or `D`. |
| Cast your commander | Click it in your rail. The commander tax is counted on its badge (+2 per earlier cast). You pay it yourself. |
| Attack | Right-click a creature and choose **Attacking**. |
| Block | Right-click your creature, choose **Blocking…**, then click the attacker. An arrow shows the block. |
| Target something | Right-click the card doing the targeting, choose **Target…**, then click the target. |
| Add counters | Right-click a permanent and use the **+1/+1**, **−1/−1** or **Counter** steppers. **Add label…** adds a word such as flying or haste. |
| Move a card anywhere | Right-click it and pick a destination: **Hand**, **GY**, **Exile**, **Play**, **Cmd**, or the **Top** or **Bottom** of a library. |
| Act on several permanents | Shift-click them, then use the bar that appears: **Tap**, **Untap** or **To graveyard**. |
| Change your life | Use **−** and **+** (or the `−` and `+` keys), or click your life total to change it by any amount. |
| Take commander damage | Use the commander damage control in your bar. Commander damage also takes the life. |
| End your turn | **Pass turn**, or `P`. The next player untaps and the combat markers clear. |

### Your library

Under **More ⋯**:

- **Search library** opens your whole library. A box at the top finds a card by name or type
  ("land", "creature"). Every card offers **Hand**, **Play**, **Top** and **Bottom**, and the
  library shuffles itself when you close it.
- **Peek / Scry…** shows the top cards in order, with the same four choices. It does not shuffle.
- **Mill…** puts cards from the top of your library into your graveyard.
- **Shuffle**, and a mid-game **Mulligan…**, which asks first.

### Tokens, dice and the rest

Also under **More ⋯**:

- **Create token…** asks for a name, type and power/toughness, and how many. To make more of a
  token already in play, right-click it and choose **Duplicate**.
- **Roll dice…** and **Flip coin**. Results go in the log for everyone.
- **Clear markers & counters…** takes every counter and label off every card on the table. It asks
  first and says how many it would remove.

When your commander dies or is exiled, the top bar offers to send it to the command zone. **Leave
it** declines for now, and you are asked again if it comes back and dies again.

## Hidden cards

The table keeps hidden information hidden. Opponents see the backs of the cards in your hand,
nobody sees your library unless you search or peek, and a card turned face down shows its back to
everyone but its controller. **Turn face down** and **Turn face up** are in a permanent's menu. The
log names the cards everyone could see, such as "Alice moved Sol Ring to the battlefield", and says
"a card" for anything someone couldn't.

## Mistakes and undo

**Undo** (or `Z`) takes back the last action, and the button says which. If it was yours and
nobody has acted since, it is instant. Otherwise it asks you first, then the table votes: everyone sees what would be undone and how many approvals it
needs, and approves or rejects it. The result is announced either way. An undo can't make anyone
forget what they saw; if it hides something again, the log says so.

## Ending a game

**Concede** is under **More ⋯**. When only one player is left, the table says who won and shows
everyone's standing. You can keep looking at the table, and the host can take everyone back to the
lobby for another game. The host can also end a game at any time from the gear menu.

## Keyboard shortcuts

| Key | Does |
|---|---|
| `D` | Draw a card |
| `U` | Untap all your permanents, and empty your mana pool |
| `P` | Pass the turn (asks first if it isn't yours) |
| `+` / `−` | Gain or lose one life |
| `Z` | Undo |
| `F` | Fit the whole table on screen |
| `L` / `C` | Open or close the log / chat |
| `?` | Open help: how to play, and these shortcuts |
| `Esc` | Close the open menu, or clear the selection |
| `Enter` | On a focused card: play it from hand, or tap it |
| `Shift+F10` | On a focused card: open its menu |

Cards can be reached with `Tab`, so the whole game can be played from the keyboard. Shortcuts stand
down while you are typing or a dialog is open.
