// Election types
export interface Election {
    id: number;
    name: string;
    year: number;
    country: string;
    type: string;
}

export interface ElectionsResponse {
    elections: Election[];
    hasMoreElections: boolean;
}

// Location types
const Level = {
    COMPLETE: 0, // for the complete view of the electoral map
    DIVISION: 1,
    REGION: 2,
} as const;

type Level = (typeof Level)[keyof typeof Level];

export { Level };

export interface Location {
    id: number;
    name: string;
    level: Level;
    type: string;
}

export interface Division extends Location {
    level: typeof Level.DIVISION;
    type: "COUNTRY" | "STATE" | "CONGRESSIONAL DISTRICT" | "FEDERAL DISTRICT" | "CONSTITUENCY";
}

export interface Region extends Location {
    level: typeof Level.REGION;
    type: "COUNTY OR EQUIVALENT" | "PARISH" | "FEDERAL DISTRICT" | "STATE HOUSE DISTRICT";
}

// Result response types obtained from backend API
export interface Result {
    name: string;
    color: string | null;
    votes: number;
}

export interface ParticipationResult extends Result {
    party: string | null;
}

export interface CollatedResult {
    participations: ParticipationResult[];
    other: Result[];
}

export interface DivisionResultResponse {
    division: Division;
    results: CollatedResult;
}

export interface RegionResultResponse {
    region: Region;
    results: CollatedResult;
}

// Result types to pass into the frontend components
export interface LocationResult {
    location: Location;
    results: CollatedResult;
}

export interface DivisionResult extends LocationResult {
    location: Division;
}

export interface RegionResult extends LocationResult {
    location: Region;
}

export interface YearResult {
    year: number;
    results: CollatedResult;
}

// Result types used during and after frontend processing
export interface FormattedResult extends Result {
    party: string | null;
    proportion: number; // vote share as a value from 0 to 1
}

export interface FormattedHistoricalRecord {
    year: number;
    partyNamesToProportions: Record<string, number>;
}

export interface FormattedHistoricalData {
    data: FormattedHistoricalRecord[];
    distinctPartiesInvolved: { name: string; color: string }[];
}

export interface Pane {
    id: number;
    name: string;
    level: Level;
    type: string;
    winningColor: string | null;
    winningProportion: number;
    results: FormattedResult[];
}

// Types for assistant chat
export interface ChatMessage {
    id: number;
    sender: "user" | "assistant";
    text: string;
}