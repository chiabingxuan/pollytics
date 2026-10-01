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

export interface Division {
    id: number;
    name: string;
    type: string;
}

export interface Region {
    id: number;
    name: string;
    type: string;
}

// API result data types
export interface Result {
    name: string;
    color: string | null;
    votes: number;
}

export interface ParticipationResult extends Result {
    party: string | null;
}

export interface DivisionResult {
    division: Division;
    results: {
        participations: ParticipationResult[];
        other: Result[];
    };
}

// Result data types after frontend processing
export interface PaneResult extends Result {
    proportion: number; // vote share as a value from 0 to 1
}

export interface Pane {
    id: number;
    name: string;
    type: string;
    winningColor: string | null;
    winningProportion: number;
    results: PaneResult[];
}