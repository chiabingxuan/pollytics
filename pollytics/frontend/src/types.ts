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
