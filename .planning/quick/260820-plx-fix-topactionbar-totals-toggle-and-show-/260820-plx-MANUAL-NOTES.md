# Manual Notes — Top action bar: visibility controls (quick-260820-plx)

Manual-ready notes for the How-To-Manual. Covers the Totals toggle and the
three-state Show All / Hide All highlight on the top action bar.

---

## Top action bar — visibility controls

The right-hand group of the top action bar holds three buttons that control what
you can see: **Totals**, **Show All**, and **Hide All**. All three are lit when
the app is in the state they represent, so the bar doubles as a status readout —
you can tell what is hidden without opening anything.

### Totals

The **Totals** button (table icon) shows and hides the Totals panel on the right
edge of the window.

- Click it once to collapse the panel, click again to reopen it.
- The button stays **lit while the panel is open** and goes dark when it is
  closed.
- The button and the panel's own collapse chevron are two views of the **same**
  setting. Collapse the panel with its chevron and the top-bar button goes dark
  in the same instant; reopen it from the top bar and the panel slides back.
- The panel's open/closed state and its width are remembered between sessions.
- Drag the divider left from the collapsed rail to reveal Totals immediately.
- Drag it fully right to show the same narrow rail as the button or chevron.
  Reopening restores the last expanded width.

Category collapse is a known deferred issue: during the 2026-10-21 walkthrough,
the user reported headings did not collapse and chose to skip this feature as
unnecessary. Its shared-state behavior has not been accepted in human testing.

### Show All

**Show All** (eye icon) makes every markup on every page visible again, clearing
the whole hidden-items list in one click.

- It is **lit when nothing is hidden** — i.e. when everything you have drawn is
  currently on screen.
- It is disabled until a PDF is open.

### Hide All

**Hide All** (crossed-out eye icon) hides every markup on every page at once.

- It is **lit only when everything is hidden**. Bring back even one item and it
  goes dark.
- It is disabled until a PDF is open, and stays disabled while the project has
  no markups. On an empty project it is never lit.

### Reading the partial state

If you hide items one at a time using the lightbulb on each Totals row, you end
up somewhere between "all visible" and "all hidden". In that case **both Show
All and Hide All are dark**.

Two dark buttons means *"some markups are hidden"*. Keep hiding rows and Hide
All lights up the moment the **last** visible item is hidden; click Show All at
any point and it lights up as everything comes back.

| What you see | What it means |
| --- | --- |
| Show All lit, Hide All dark | Nothing is hidden — every markup is visible |
| Show All dark, Hide All lit | Everything is hidden |
| Both dark | Partially hidden — some items are hidden, some are visible |

### Where these preferences are stored

Panel preferences — the Totals panel's open/closed state, its width, and which
categories are collapsed — are stored **per workstation**, not inside the
`.clmc` project file. Open the same project on a different machine and that
machine's own panel layout applies. This is deliberate: the layout follows the
estimator, the takeoff data follows the project.

Hidden items are different — they *are* part of the project. Show All and Hide
All both mark the project as unsaved, so remember to save if you want the
visibility state to persist with the file.
