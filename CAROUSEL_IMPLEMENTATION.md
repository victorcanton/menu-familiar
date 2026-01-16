# Mobile Day Carousel Implementation

## Overview
A horizontal day carousel has been implemented for mobile screens (≤640px) that provides an intuitive swiping experience with visual feedback on the active day.

## Key Features Implemented

### 1. Visual Design
- **Active Day**: Centered with full opacity (1.0) and normal scale (1.0) + shadow effect
- **Side Days**: 25% visible on left/right with reduced opacity (0.7) and slight scale (0.95)
- **Visual Feedback**: Smooth transitions (0.3s ease) when scrolling between days

### 2. Scroll Behavior
- **Snap Type**: `scroll-snap-type: x mandatory` - strictly snaps to one full day
- **Snap Alignment**: `scroll-snap-align: center` + `scroll-snap-stop: always`
- **Scrolling**: Smooth horizontal scrolling with touch optimization (`-webkit-overflow-scrolling: touch`)
- **No Scrollbar**: Hidden on all modern browsers (webkit, Firefox, IE/Edge)

### 3. Layout
- Full viewport width implementation with proper centering
- Each day occupies `calc(100vw - 40px)` to show adjacent days
- Container uses `width: 100vw` and `margin-left: calc(-50vw + 50%)` to extend beyond normal padding

### 4. Vertical Scrolling
- Each day maintains `overflow-y: auto` for meal scrolling
- `max-height: calc(100vh - 200px)` ensures space for header/footer
- Touch scrolling optimized with `-webkit-overflow-scrolling: touch`

### 5. JavaScript Enhancement
- `scrollToDateOnMobile()` centers the active day using `scrollIntoView({ inline: "center" })`
- Applies `.active` class for CSS styling (opacity/scale changes)
- Called automatically after DOM render in daily view
- Checks breakpoint (`<=640px`) before activating

## Responsive Behavior
- **Mobile (≤640px)**: Horizontal carousel activated
- **Tablet/Desktop (>640px)**: Standard layout remains unchanged
- **Landscape (≤980px)**: Standard layout with adjusted typography
- **Large Screens (>980px)**: Weekly 7-column grid view

## Files Modified
- `public/index.html`
  - CSS: New media query `@media (max-width: 640px)` with carousel styles
  - JS: Updated `scrollToDateOnMobile()` function
  - JS: Added `scrollToDateOnMobile()` call in `renderBoardDaily()`

## Technical Details
- **CSS Properties Used**: Flexbox, scroll-snap, transform, opacity, transition
- **JS Features**: `scrollIntoView()` API, classList manipulation, matchMedia checks
- **Browser Support**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **No Breaking Changes**: Existing business logic and data structures remain untouched

## User Experience
The implementation provides a native mobile app feel:
- Intuitive horizontal swipe navigation
- Clear visual indication of the current day
- Smooth animations and transitions
- Maintains full functionality for meal editing and vertical scrolling
