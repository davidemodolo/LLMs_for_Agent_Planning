# load all the paths for the files inside heatmap/heatmaps/gpt-4o-mini/... that are called topX_values.json
from glob import glob
import os
import json

starting_path = "data_and_results/heatmap/heatmaps/gpt-4o-mini/"
all_paths = glob(f"{starting_path}**/topX_values.json", recursive=True)

print(all_paths)