# import os

# def find_heatmap_json_files(root_folder):
#     heatmap_files = []
#     for dirpath, _, filenames in os.walk(root_folder):
#         for filename in filenames:
#             if filename == 'heatmap.json':
#                 heatmap_files.append(os.path.join(dirpath, filename))
#     return heatmap_files

# if __name__ == "__main__":
#     root_folder = 'data_and_results'
#     heatmap_files = find_heatmap_json_files(root_folder)
#     heatmap_files = [hm for hm in heatmap_files if 'gpt-4o-mini' in hm]
#     for file in heatmap_files:
#         size = int((int(file.split('\\')[4].split("x")[0])-1)/2)
#         if f"pos_{size}" in file:
#             print(file)

files = """data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\13x13_map\\deliver\\pos_6_6\\20250115-143427\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\13x13_map\\path_finding\\pos_6_6\\oriented_20250118-185924\\heatmap.json    
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\13x13_map\\pickup\\pos_6_6\\20250115-142522\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\21x21_map\\deliver\\pos_10_10\\20250115-170556\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\21x21_map\\pickup\\pos_10_10\\20250115-164017\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\3x3_map\\deliver\\pos_1_1\\20250115-135918\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\3x3_map\\pickup\\pos_1_1\\20250115-140154\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\5x5_map\\deliver\\pos_2_2\\20250115-140821\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\5x5_map\\path_finding\\pos_2_2\\oriented_20250118-184923\\heatmap.json      
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\5x5_map\\pickup\\pos_2_2\\20250115-140439\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\7x7_map\\deliver\\pos_3_3\\20250115-141540\\heatmap.json
data_and_results\\heatmap\\heatmaps\\gpt-4o-mini\\7x7_map\\pickup\\pos_3_3\\20250115-141203\\heatmap.json"""

import json
import os
from glob import glob

def load_json(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

def rescale_values(values):
    filtered_values = [v for v in values if v[1]]  # Keep only where second value is True
    total = sum(v[2] for v in filtered_values)
    return [(v[0], v[2] / total * 100) for v in filtered_values] if total > 0 else []

def get_correct_actions(x, y, goal_x, goal_y):
    correct_actions = []
    if y < goal_x:
        correct_actions.append("R")  # Move right
    if y > goal_x:
        correct_actions.append("L")  # Move left
    if x < goal_y:
        correct_actions.append("D")  # Move down
    if x > goal_y:
        correct_actions.append("U")  # Move up
    return correct_actions

def process_file(filepath):
    data = load_json(filepath)
    grid_size = next(item for item in data if isinstance(item, dict) and 'w' in item)['w']

    goal_x, goal_y = grid_size // 2, grid_size // 2  # Center of the grid
    
    quadrants = {"top-left": [], "top-right": [], "bottom-left": [], "bottom-right": []}
    
    for cell in filter(lambda d: isinstance(d, dict) and 'x' in d and 'y' in d, data):
        x, y = cell['x'], cell['y']
        rescaled = rescale_values(cell['values'])
        correct_actions = get_correct_actions(x, y, goal_x, goal_y)
        correct_percentage = sum(v[1] for v in rescaled if v[0] in correct_actions)
        
        if y != goal_x and x != goal_y:  # Ignore central row and column
            if y < goal_x and x < goal_y:
                quadrants["top-left"].append(correct_percentage)
            elif y > goal_x and x < goal_y:
                quadrants["top-right"].append(correct_percentage)
            elif y < goal_x and x > goal_y:
                quadrants["bottom-left"].append(correct_percentage)
            elif y > goal_x and x > goal_y:
                quadrants["bottom-right"].append(correct_percentage)
    
    averages = {q: sum(values) / len(values) if values else 0 for q, values in quadrants.items()}
    return averages

def process_file_columns(filepath):
    data = load_json(filepath)
    grid_size = next(item for item in data if isinstance(item, dict) and 'w' in item)['w']

    goal_x, goal_y = grid_size // 2, grid_size // 2  # Center of the grid
    
    quadrants = {"top-column": [], "left-row": [], "bottom-column": [], "right-row": []}
    
    for cell in filter(lambda d: isinstance(d, dict) and 'x' in d and 'y' in d, data):
        x, y = cell['x'], cell['y']
        rescaled = rescale_values(cell['values'])
        correct_actions = get_correct_actions(x, y, goal_x, goal_y)
        correct_percentage = sum(v[1] for v in rescaled if v[0] in correct_actions)
        
        if (y == goal_x) != (x == goal_y):  # only central row and column
            if y < goal_x:
                quadrants["left-row"].append(correct_percentage)
            elif y > goal_x:
                quadrants["right-row"].append(correct_percentage)
            elif x > goal_y:
                quadrants["bottom-column"].append(correct_percentage)
            elif x < goal_y:
                quadrants["top-column"].append(correct_percentage)
    averages = {q: sum(values) / len(values) if values else 0 for q, values in quadrants.items()}
    return averages

avgs = []
for file in files.split('\n'):
    averages = process_file(file)
    avgs.append(averages)
    print(f"{file} -> {averages}")

# Calculate the average of the averages
final_avg = {q: sum(avgs[q] for avgs in avgs) / len(avgs) for q in avgs[0]}
print(f"Final average: {final_avg}")

avgs = []
for file in files.split('\n'):
    averages = process_file_columns(file)
    avgs.append(averages)
    print(f"{file} -> {averages}")

# Calculate the average of the averages
final_avg = {q: sum(avgs[q] for avgs in avgs) / len(avgs) for q in avgs[0]}
print(f"Final average: {final_avg}")