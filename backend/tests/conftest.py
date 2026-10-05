import pytest
from app import create_app
from database import init_db

@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # create the app with common test config
    app = create_app()
    app.config.update({
        "TESTING": True,
        "DATABASE_PATH": ":memory:",
    })

    # create the database and load test data
    with app.app_context():
        init_db(app)

    yield app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()
