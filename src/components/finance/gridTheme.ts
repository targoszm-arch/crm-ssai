import { themeQuartz, colorSchemeDark } from "ag-grid-community";

/**
 * AG Grid wearing this app's design tokens.
 *
 * v33 replaced the CSS-file themes with a theming API, so a theme is an object
 * built by `.withParams()` rather than an imported stylesheet. That is what
 * lets the grid read the same HSL variables `index.css` already defines, so it
 * cannot drift from the rest of the app the way a copied colour would.
 *
 * `hsl(var(--x))` works because the variables hold bare triplets ("222 47% 11%")
 * — the same form every Tailwind class in this project consumes.
 */
const base = {
  backgroundColor: "hsl(var(--card))",
  foregroundColor: "hsl(var(--card-foreground))",
  borderColor: "hsl(var(--border))",
  headerBackgroundColor: "hsl(var(--muted))",
  headerTextColor: "hsl(var(--muted-foreground))",
  oddRowBackgroundColor: "transparent",
  rowHoverColor: "hsl(var(--muted) / 0.4)",
  selectedRowBackgroundColor: "hsl(var(--primary) / 0.08)",
  accentColor: "hsl(var(--primary))",
  inputFocusBorder: "hsl(var(--ring))",

  // Matches the app's type scale rather than AG Grid's default 14px/500.
  fontFamily: "inherit",
  fontSize: "13px",
  headerFontSize: "11px",
  headerFontWeight: 600,

  // Tighter than the Quartz default so twenty columns still fit a laptop.
  rowHeight: 40,
  headerHeight: 38,
  cellHorizontalPadding: 10,

  borderRadius: "0px",
  wrapperBorder: false,
  headerRowBorder: true,
  rowBorder: true,
  columnBorder: false,
};

export const financeGridTheme = themeQuartz.withParams(base);

/**
 * Dark mode is a separate params object rather than a media query inside one
 * theme: AG Grid resolves params once, so a single theme cannot hold both.
 * The component picks between them from the `dark` class on <html>, which is
 * how the rest of the app decides too.
 */
export const financeGridThemeDark = themeQuartz
  .withPart(colorSchemeDark)
  .withParams(base);
