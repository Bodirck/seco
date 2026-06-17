import sqlite3

import pytest

from buildinglens import db


def test_init_and_roundtrip(tmp_path):
    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    conn.execute("INSERT INTO buildings (name, source) VALUES (?, ?)", ("Tower A", "test"))
    conn.execute("INSERT INTO documents (building_id, type) VALUES (?, ?)", (1, "inspection_report"))
    conn.execute(
        "INSERT INTO defects (building_id, document_id, element, severity) VALUES (?, ?, ?, ?)",
        (1, 1, "roof", "major"),
    )
    conn.commit()

    assert conn.execute("SELECT name FROM buildings").fetchone()["name"] == "Tower A"
    assert conn.execute("SELECT severity FROM defects").fetchone()["severity"] == "major"


def test_severity_check_rejects_unknown_value(tmp_path):
    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO defects (building_id, document_id, severity) VALUES (?, ?, ?)",
            (1, 1, "catastrophic"),
        )


def test_reset_clears_tables(tmp_path):
    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    conn.execute("INSERT INTO buildings (name) VALUES ('x')")
    conn.commit()
    db.reset(conn)
    assert conn.execute("SELECT COUNT(*) AS c FROM buildings").fetchone()["c"] == 0
