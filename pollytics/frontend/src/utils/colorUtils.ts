import chroma from "chroma-js";

export type ColorInterval = {
    index: number;
    min: number;
    max: number;
};

const DEFAULT_COLOR: string = "#6B7280";
export const COLOR_INTERVALS: ColorInterval[] = [
    { index: 0, min: 0, max: 0.50 },
    { index: 1, min: 0.50, max: 0.60 },
    { index: 2, min: 0.60, max: 0.70 },
    { index: 3, min: 0.70, max: 0.80 },
    { index: 4, min: 0.80, max: 0.90 },
    { index: 5, min: 0.90, max: 1.00 },
];

export function assignDefaultColorIfNeeded(color: string | null) {
    return color ?? DEFAULT_COLOR;
}

function getLightShadeOfBaseColor(baseColor: string): string {
    const WHITE_COLOR = "#FFFFFF";
    const WHITE_FRACTION_TO_MIX = 0.65;

    return chroma(baseColor).mix(WHITE_COLOR, WHITE_FRACTION_TO_MIX).hex();
}

function getDarkShadeOfBaseColor(baseColor: string): string {
    const BLACK_COLOR = "#000000";
    const BLACK_FRACTION_TO_MIX = 0.75;

    return chroma(baseColor).mix(BLACK_COLOR, BLACK_FRACTION_TO_MIX).hex();
}

export function shiftColorToIntervalShade(baseColor: string, interval: ColorInterval) {
    // Get equally spaced shades of the base colour
    const bucketColors = chroma.scale([
        getLightShadeOfBaseColor(baseColor),
        baseColor,
        getDarkShadeOfBaseColor(baseColor)
    ])
        .domain([0, 0.5, 1])
        .colors(COLOR_INTERVALS.length);
    
    // Select the shade corresponding to the specified interval
    return bucketColors[interval.index];
}

function getWinningColorInterval(winningProportion: number): ColorInterval {
    const interval = COLOR_INTERVALS.find(
        ({ min, max }) => winningProportion >= min && winningProportion < max
    );

    // Handle the case where winning proportion is
    // exactly 1 (interval will only be null for this case)
    return interval ?? COLOR_INTERVALS[COLOR_INTERVALS.length - 1];
}

export function getColorFromWinningProportion(baseColor: string, winningProportion: number): string {
    return shiftColorToIntervalShade(baseColor, getWinningColorInterval(winningProportion));
}