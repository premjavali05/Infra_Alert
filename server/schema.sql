-- Infra-Alert schema translated to PostgreSQL.
-- Keeps the column names used by the original PHP application.
-- Run against a NEW database; this script does not import old .ibd files.

CREATE TABLE IF NOT EXISTS u_register (
    name VARCHAR(150) NOT NULL,
    phno VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    pass VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_register (
    eid VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    phno VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    state VARCHAR(10) NOT NULL,
    category VARCHAR(80) NOT NULL,
    department VARCHAR(255) NOT NULL,
    city VARCHAR(150) NOT NULL,
    pass VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS complaint (
    cid VARCHAR(32) PRIMARY KEY,
    phno VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    state VARCHAR(10) NOT NULL,
    category VARCHAR(80) NOT NULL,
    dept VARCHAR(255) NOT NULL,
    city VARCHAR(150) NOT NULL,
    district VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    img_url TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Solved', 'Rejected')),
    solved_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS save_location (
    pno VARCHAR(20) NOT NULL,
    img_url TEXT NOT NULL DEFAULT '',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    accuracy_m NUMERIC(8, 2),
    address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS solved_img (
    cid VARCHAR(32) NOT NULL,
    eid VARCHAR(80) NOT NULL,
    solved_url TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_complaint_phno ON complaint(phno);
CREATE INDEX IF NOT EXISTS idx_complaint_scope ON complaint(category, dept, state, city, status);
CREATE INDEX IF NOT EXISTS idx_locations_pno ON save_location(pno);
CREATE INDEX IF NOT EXISTS idx_solved_img_cid ON solved_img(cid);
