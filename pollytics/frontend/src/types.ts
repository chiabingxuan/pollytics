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
export interface Location {
    id: number;
    name: string;
    level: "DIVISION" | "REGION";
    type: string;
}

export interface Division extends Location {
    level: "DIVISION";
    type: "COUNTRY" | "STATE" | "CONGRESSIONAL DISTRICT" | "FEDERAL DISTRICT" | "CONSTITUENCY";
}

export interface Region extends Location {
    level: "REGION";
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

export interface DivisionResultResponse {
    division: Division;
    results: {
        participations: ParticipationResult[];
        other: Result[];
    };
}

export interface RegionResultResponse {
    region: Region;
    results: {
        participations: ParticipationResult[];
        other: Result[];
    };
}

// Result types to pass into the frontend components
export interface LocationResult {
    location: Location;
    results: {
        participations: ParticipationResult[];
        other: Result[];
    };
}

export interface DivisionResult extends LocationResult {
    location: Division;
}

export interface RegionResult extends LocationResult {
    location: Region;
}

// Result types after frontend processing
export interface PaneResult extends Result {
    party: string | null;
    proportion: number; // vote share as a value from 0 to 1
}

export interface Pane {
    id: number;
    name: string;
    level: "DIVISION" | "REGION";
    type: string;
    winningColor: string | null;
    winningProportion: number;
    results: PaneResult[];
}