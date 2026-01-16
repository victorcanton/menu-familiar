# Mobile Day Carousel - Visual Layout

## Carousel Layout on Mobile (≤640px)

### Visual Representation

```
┌─────────────────────────────────────────────────┐
│ HEADER (remains in place)                       │
├─────────────────────────────────────────────────┤
│   ┌─────────────────┐                           │
│   │   25% prev day  │ 100% ACTIVE DAY (centered) │ 25% next day │
│   │  (70% opacity)  │ (100% opacity, scale 1.0, │ (70% opacity) │
│   │  (scale 0.95)   │  shadow)                  │ (scale 0.95)  │
│   └─────────────────┴───────────────────────────┴───────────────┘
│   <- HORIZONTAL SCROLL, SNAP TO CENTER ->
│
│   ┌─────────────────────────────────────────────┐
│   │ MON 15 January                              │
│   ├─────────────────────────────────────────────┤
│   │ Breakfast: [click to add]                   │
│   │ Lunch: Pasta + Salad                        │
│   │ Dinner: Grilled chicken                     │
│   │ [vertical scroll if needed]                 │
│   └─────────────────────────────────────────────┘
│
│   ... (sidebar days partially visible)
│
└─────────────────────────────────────────────────┘
```

## Snap Points Behavior

```
User swipes left (or scrolls):

Initial State:        After Snap:          After Another Swipe:
┌──────┬──────┬──────┐  ┌──────┬──────┬──────┐  ┌──────┬──────┬──────┐
│ MON  │ TUE  │ WED  │  │ TUE  │ WED  │ THU  │  │ WED  │ THU  │ FRI  │
│      │ ◆◆◆  │      │  │      │ ◆◆◆  │      │  │      │ ◆◆◆  │      │
│ 70%  │100%  │70%   │  │ 70%  │100%  │70%   │  │ 70%  │100%  │70%   │
└──────┴──────┴──────┘  └──────┴──────┴──────┘  └──────┴──────┴──────┘
 
 (◆ = active/centered day)
```

## Width Calculations

### Element Sizes
```
Viewport width (100vw)
├─ Left padding: 0px (handled by margin-left)
├─ Day width: calc(100vw - 40px)
│   ├─ Left padding: 20px
│   ├─ Content: ~(100vw - 40px - 40px)
│   └─ Right padding: 20px
└─ Right padding: 0px (handled by margin-left)
```

### Visible Portions
```
Desktop Width: 1200px
Mobile Width: 375px (iPhone SE)

At 375px viewport:
- Full day width: 335px (375 - 40)
- Left 25% visible: ~84px
- Center visible: 375px (full viewport)
- Right 25% visible: ~84px
- Left hidden: 251px
- Right hidden: 251px

Scroll snap aligns to:
- Left edge of previous day at: -167px (half-width to left)
- Center of active day at: 0px
- Right edge of next day at: +167px (half-width to right)
```

## Opacity & Scale Transitions

### State Changes
```
Side Day (initial)          →  Center Day (after snap)
opacity: 0.7                   opacity: 1.0
transform: scale(0.95)         transform: scale(1.0)
no shadow                       box-shadow: 0 8px 24px(...)

Transition: 0.3s ease
(smooth animation when scrolling)
```

## Vertical Scrolling Inside Day

```
┌─────────────────────────────────────────┐
│ Day Header (sticky)                     │
├─────────────────────────────────────────┤
│ Breakfast                      ↑        │
│ [+]                            │        │
│                                │        │ vertical
│ Lunch: Pasta + Salad           │        │ scroll
│ [+]                            │        │ (max-height:
│                                │        │  100vh - 200px)
│ Dinner: Grilled chicken        │        │
│ [+]                            │        │
│                                ↓        │
└─────────────────────────────────────────┘

Horizontal scroll enabled:  YES (full carousel)
Vertical scroll enabled:    YES (inside day)
Both scrolls work simultaneously without interference
```

## Breakpoint Behavior

### Mobile (≤640px)
```
Carousel CSS applies:
- Horizontal flex layout
- Scroll snap active
- Side days visible and de-emphasized
- Touch-optimized scrolling
```

### Tablet (641px - 980px)
```
Vertical layout CSS applies:
- Single day per "row" (grid-template-columns: 1fr)
- Standard scrolling (no snap)
- Full width utilization
```

### Desktop (>980px)
```
Weekly view CSS applies:
- 7-column grid
- All days visible at once
- No horizontal scrolling
```

## Animation Timeline

```
User Action: Swipe to next day

0ms   ├─ Touch detected
      ├─ scrollToDateOnMobile() called
      │
300ms ├─ Scroll animation completes
      ├─ snapToCenter() finishes
      │
      ├─ CSS transition triggers:
      │  - Previous active day: opacity 1.0 → 0.7
      │  - New active day: opacity 0.7 → 1.0
      │  - Prev day: scale 1.0 → 0.95
      │  - New day: scale 0.95 → 1.0
      │
600ms └─ All transitions complete (0.3s × 2 days)
        App ready for next interaction
```

## Responsive Padding

```
Container structure:
<div class="container">          <!-- padding: 10px -->
  <div class="board">            <!-- padding: 0 (at ≤640px) -->
    <div class="weekCols">       <!-- width: 100vw, margin-left adjusts -->
      <div class="dayCol">       <!-- width: 100vw - 40px, padding: 0 20px -->
        <!-- content -->
      </div>
    </div>
  </div>
</div>

Note: margin-left: calc(-50vw + 50%) expands .weekCols to full viewport
while keeping day content within safe area
```
