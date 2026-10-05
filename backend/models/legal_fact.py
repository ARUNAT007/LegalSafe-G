import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class LegalFact:
    """Represents an extracted legal fact from a document clause."""
    fact_id: str = ""
    clause_id: str = ""
    source_text: str = ""
    subject: Optional[str] = None
    action: Optional[str] = None
    obj: Optional[str] = None
    modality: Optional[str] = None
    amount: Optional[str] = None
    currency: Optional[str] = None
    percentage: Optional[str] = None
    deadline: Optional[str] = None
    duration: Optional[str] = None
    frequency: Optional[str] = None
    condition: Optional[str] = None
    conditions: List[str] = field(default_factory=list)
    exception: Optional[str] = None
    exceptions: List[str] = field(default_factory=list)
    penalty: Optional[str] = None
    consequence: Optional[str] = None
    parties: List[str] = field(default_factory=list)
    organizations: List[str] = field(default_factory=list)
    dates: List[str] = field(default_factory=list)
    locations: List[str] = field(default_factory=list)
    rights: List[str] = field(default_factory=list)
    obligations: List[str] = field(default_factory=list)
    prohibitions: List[str] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)
    extra_fields: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Converts the dataclass instance to a dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LegalFact':
        """Creates a LegalFact instance from a dictionary."""
        # Filter out fields that are not part of the dataclass
        field_names = set(f.name for f in cls.__dataclass_fields__.values())
        filtered_data = {k: v for k, v in data.items() if k in field_names}
        
        # Handle extra_fields if present in data but not as a recognized field
        extra = {k: v for k, v in data.items() if k not in field_names}
        if extra:
            filtered_data['extra_fields'] = filtered_data.get('extra_fields', {})
            filtered_data['extra_fields'].update(extra)
            
        return cls(**filtered_data)

    def to_json(self) -> str:
        """Converts the dataclass instance to a JSON string."""
        return json.dumps(self.to_dict())
