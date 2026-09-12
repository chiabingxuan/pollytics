CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS country_borders (
    country_id INT REFERENCES countries(id),
    year INT,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    PRIMARY KEY (country_id, year)
);

CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    country_id INT NOT NULL REFERENCES countries(id),
    parent_region_id INT NOT NULL REFERENCES regions(id), -- a region will be a child of itself if there is nothing bigger
    type VARCHAR(256) NOT NULL CHECK (type IN ('state', 'county')),
    UNIQUE (name, parent_region_id)
);

CREATE TABLE IF NOT EXISTS region_borders (
    region_id INT REFERENCES regions(id),
    year INT,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    PRIMARY KEY (region_id, year)
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
    year INT NOT NULL,
    type VARCHAR(64) NOT NULL CHECK (type IN ('presidential', 'senate', 'house', 'gubernatorial')),
    UNIQUE (country_id, year, type)
);

CREATE TABLE IF NOT EXISTS candidacies (
    id SERIAL PRIMARY KEY,
    election_id INT NOT NULL REFERENCES elections(id),
    candidate_id INT NOT NULL REFERENCES candidates(id),
    UNIQUE (election_id, candidate_id)
);


CREATE TABLE IF NOT EXISTS candidacy_parties (
    candidacy_id INT PRIMARY KEY REFERENCES candidacies(id),
    party_id INT NOT NULL REFERENCES parties(id)
);

-- for vote counts of the candidacies recorded
CREATE TABLE IF NOT EXISTS main_results (
    candidacy_id INT REFERENCES candidacies(id),
    region_id INT REFERENCES regions(id),
    votes INT NOT NULL CHECK (votes >= 0),
    PRIMARY KEY (candidacy_id, region_id)
);

-- for vote counts outside of the main candidacies
-- eg. other minor candidates, spoiled votes, etc.
CREATE TABLE IF NOT EXISTS other_results (
    election_id INT REFERENCES elections(id),
    region_id INT REFERENCES regions(id),
    votes INT NOT NULL CHECK (votes >= 0),
    type VARCHAR(64) CHECK (type IN ('other_cands', 'spoiled', 'undervotes', 'overvotes')),
    PRIMARY KEY (election_id, region_id, type)
);