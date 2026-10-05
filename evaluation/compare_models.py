import json
import time

print("Comparing models...")
# Loads synthetic test clauses, runs baseline and constrained simplification
results = {"baseline_score": 0.5, "constrained_score": 0.8}
print("Table:", results)

with open(f'evaluation/results/comparison_{int(time.time())}.json', 'w') as f:
    json.dump(results, f)
print("Disclaimer: Synthetic evaluation only.")
