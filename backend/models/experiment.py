import json
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Optional

@dataclass
class Experiment:
    """Represents a simplification experiment with metrics and config."""
    name: str
    config: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    id: Optional[int] = None
    timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Experiment':
        return cls(**data)
        
    def save(self, db_conn) -> int:
        """Save the experiment to the database using the provided connection."""
        cursor = db_conn.cursor()
        cursor.execute(
            '''
            INSERT INTO experiments (name, metrics, config)
            VALUES (?, ?, ?)
            ''',
            (self.name, json.dumps(self.metrics), json.dumps(self.config))
        )
        self.id = cursor.lastrowid
        db_conn.commit()
        return self.id
