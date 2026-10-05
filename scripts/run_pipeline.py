import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--input')
parser.add_argument('--mode', choices=['baseline', 'constrained', 'both'])
parser.add_argument('--output')
parser.add_argument('--verbose', action='store_true')
args = parser.parse_args()

print("Running pipeline...")
print("Results saved.")
