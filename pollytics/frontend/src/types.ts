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

export interface Results {
    name: string;
    color: string | null;
    votes: number;
    percentage: number;
}

export interface ParticipationResults extends Results {
    party: string | null;
}

export interface DivisionResult {
    division: Division;
    results: {
        participations: ParticipationResults[];
        other: Results[];
    };
}

export interface PaneProperties {
    id: number;
    name: string;
    type: string;
    winningColor: string;
    winningProportion: number;
    results: Results[];
}