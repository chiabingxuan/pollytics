CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) UNIQUE NOT NULL
);

/*
Represents electoral divisions, within which electoral contests take place.

Eg. Country, state, congressional district, constituency.
*/
CREATE TABLE IF NOT EXISTS divisions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    country_id INT NOT NULL REFERENCES countries(id),
    type VARCHAR(256) NOT NULL CHECK (type IN ('COUNTRY', 'STATE', 'CONGRESSIONAL DISTRICT', 'FEDERAL DISTRICT', 'CONSTITUENCY')), -- a country can also a division at-large
    UNIQUE (name, country_id)
);

CREATE TABLE IF NOT EXISTS division_borders (
    division_id INT REFERENCES divisions(id),
    year_drawn INT,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    PRIMARY KEY (division_id, year_drawn)
);

/*
Regional results may be available for a division.
The same region may appear in multiple divisions,
and the division-region relationship may vary across elections.

Eg. A state has many counties; a congressional district has a few counties.
Note that the same county may be in multiple congressional districts.
*/
CREATE TABLE IF NOT EXISTS regions (
    id INT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    country_id INT NOT NULL REFERENCES countries(id),
    type VARCHAR(256) NOT NULL CHECK (type IN ('COUNTY OR EQUIVALENT', 'PARISH', 'FEDERAL DISTRICT', 'STATE HOUSE DISTRICT'))
);

CREATE TABLE IF NOT EXISTS region_borders (
    region_id INT REFERENCES regions(id),
    year_drawn INT,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    PRIMARY KEY (region_id, year_drawn)
);

CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS parties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    country_id INT NOT NULL REFERENCES countries(id),
    color VARCHAR(7),  -- hexadecimal
    UNIQUE (name, country_id)
);

CREATE TABLE IF NOT EXISTS elections (
    id SERIAL PRIMARY KEY,
    country_id INT NOT NULL REFERENCES countries(id),
    name VARCHAR(256) NOT NULL,
    year INT NOT NULL,
    type VARCHAR(64) NOT NULL CHECK (type IN ('PRESIDENT', 'SENATE', 'HOUSE', 'GOVERNOR')),
    UNIQUE (country_id, name, year)
);

/*
Represents individual electoral contests, each corresponding to a (election, division) pair.
Eg. House race for the 2020 US election in Michigan's 1st district.
*/
CREATE TABLE IF NOT EXISTS races (
    election_id INT REFERENCES elections(id),
    division_id INT REFERENCES divisions(id),
    PRIMARY KEY (election_id, division_id)
);

/*
Represents candidates participating in races.
*/
CREATE TABLE IF NOT EXISTS participations (
    candidate_id INT REFERENCES candidates(id),
    election_id INT,
    division_id INT,
    total_votes INT NOT NULL CHECK (total_votes >= 0),
    PRIMARY KEY (candidate_id, election_id, division_id),
    FOREIGN KEY (election_id, division_id) REFERENCES races(election_id, division_id)
);

CREATE TABLE IF NOT EXISTS participation_parties (
    candidate_id INT,
    election_id INT,
    division_id INT, 
    party_id INT NOT NULL REFERENCES parties(id),
    PRIMARY KEY (candidate_id, election_id, division_id),
    FOREIGN KEY (candidate_id, election_id, division_id) REFERENCES participations(candidate_id, election_id, division_id)
);

/*
Represents reported vote categories that are not associated
with a known candidate participation.
"OTHER" represents votes aggregated by the source datasets
whose underlying candidates or vote categories cannot be distinguished.
*/
CREATE TABLE IF NOT EXISTS other_vote_types (
    type VARCHAR(64) PRIMARY KEY CHECK (type IN ('OTHER', 'SPOILED', 'UNDERVOTES', 'OVERVOTES'))
);

/*
Represents race-wide vote counts outside of the known participations.
*/
CREATE TABLE IF NOT EXISTS other_racewide_results (
    election_id INT,
    division_id INT,
    type VARCHAR(64) REFERENCES other_vote_types(type),
    votes INT NOT NULL CHECK (votes >= 0),
    PRIMARY KEY (election_id, division_id, type),
    FOREIGN KEY (election_id, division_id) REFERENCES races(election_id, division_id)
);

/*
Represents participation results by region.
*/
CREATE TABLE IF NOT EXISTS participation_regional_results (
    candidate_id INT,
    election_id INT,
    division_id INT,
    region_id INT REFERENCES regions(id),
    votes INT NOT NULL CHECK (votes >= 0),
    PRIMARY KEY (candidate_id, election_id, division_id, region_id),
    FOREIGN KEY (candidate_id, election_id, division_id) REFERENCES participations(candidate_id, election_id, division_id)
);

/*
Represents race-wide vote counts outside of the known participations, by region.
*/
CREATE TABLE IF NOT EXISTS other_regional_results (
    election_id INT,
    division_id INT,
    region_id INT REFERENCES regions(id),
    type VARCHAR(64) REFERENCES other_vote_types(type),
    votes INT NOT NULL CHECK (votes >= 0),
    PRIMARY KEY (election_id, division_id, region_id, type),
    FOREIGN KEY (election_id, division_id) REFERENCES races(election_id, division_id)
);