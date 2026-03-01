"""
Shared test fixtures — provides a TestClient and a fresh DB for each test module.
"""

import os
import tempfile
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Create a temp file for the test database before importing any app modules
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db_path = _tmp_db.name
_tmp_db.close()

TEST_DB_URL = f"sqlite:///{_tmp_db_path}"

# Override before any app module reads the config
os.environ["DATABASE_URL"] = TEST_DB_URL

from app.database import Base, get_db
from app.main import app

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """FastAPI TestClient with overridden DB dependency."""
    from fastapi.testclient import TestClient

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register_user(client, email="test@test.com", password="pass123", role="subscriber"):
    """Helper to register a user and return the token."""
    resp = client.post("/auth/register", json={"email": email, "password": password, "role": role})
    assert resp.status_code == 201, resp.json()
    return resp.json()


def auth_header(token_response):
    """Build an Authorization header dict from a register/login response."""
    return {"Authorization": f"Bearer {token_response['access_token']}"}
