# load all the paths for the files inside heatmap/heatmaps/gpt-4o-mini/... that are called topX_values.json
from glob import glob
import os
import json

starting_path = "data_and_results/heatmap/heatmaps/gpt-4o-mini/"
all_paths = glob(f"{starting_path}**/topX_values.json", recursive=True)

deliver = {} # key = map_size, value: (top1, top2, top3)
for path in all_paths:
    with open(path, 'r') as f:
        data = json.load(f)
    if "path_finding" in path:
        continue
    pt1, pt2, pt3 = data['percentage_top1'], data['percentage_top2'], data['percentage_top3']
    count1, count2, count3 = data['count_top1'], data['count_top2'], data['count_top3']
    pt2 = pt2
    pt3 = pt3
    map_size = path.split("\\")[1].split("_")[0]
    if map_size in deliver:
        existing_pt1, existing_pt2, existing_pt3 = deliver[map_size][0], deliver[map_size][1], deliver[map_size][2]
        existing_count1, existing_count2, existing_count3 = deliver[map_size][3], deliver[map_size][4], deliver[map_size][5]
        deliver[map_size] = (
            (existing_pt1 + pt1),
            (existing_pt2 + pt2),
            (existing_pt3 + pt3),
            (existing_count1 + count1),
            (existing_count2 + count2),
            (existing_count3 + count3)
        )
    else:
        deliver[map_size] = (pt1, pt2, pt3, count1, count2, count3)

for deli in deliver:
    print("\nMap size:", deli)
    top1, top2, top3 = deliver[deli][0], deliver[deli][1], deliver[deli][2]
    count1, count2, count3 = deliver[deli][3], deliver[deli][4], deliver[deli][5]
    deli_val = int(deli.split("x")[0])
    available_cells = (deli_val*deli_val-1)*6
    print("Top1 total:", count1/available_cells)
    print("Top2 total:", count2/available_cells)
    print("Top3 total:", count3/available_cells)
    # deliver[deli] = (top1/6, top2/6, top3/6)


# import matplotlib.pyplot as plt
# import seaborn as sns

# # Sort the deliver dictionary by map size
# sorted_deliver = dict(sorted(deliver.items(), key=lambda x: int(x[0].split('x')[0])))

# # create the plot with the map size on the x and for each x three bars with the percentages of top1, top2, top3
# fig, ax = plt.subplots()
# map_sizes = list(sorted_deliver.keys())
# top1 = [sorted_deliver[map_size][0] for map_size in map_sizes]
# top2 = [sorted_deliver[map_size][1] for map_size in map_sizes]
# top3 = [sorted_deliver[map_size][2] for map_size in map_sizes]

# barWidth = 0.25
# r1 = range(len(map_sizes))
# r2 = [x + barWidth for x in r1]
# r3 = [x + barWidth for x in r2]

# bars1 = plt.bar(r1, top1, color='#7ed321', width=barWidth, edgecolor='grey', label='top1')
# bars2 = plt.bar(r2, top2, color='#f8e71c', width=barWidth, edgecolor='grey', label='top2')
# bars3 = plt.bar(r3, top3, color='#f5a623', width=barWidth, edgecolor='grey', label='top3')

# # Add tendency lines
# sns.lineplot(x=[r + barWidth/2 for r in r1], y=top1, color='#7ed321', marker='o', label='top1')
# sns.lineplot(x=[r + barWidth/2 for r in r2], y=top2, color='#f8e71c', marker='o', label='top2')
# sns.lineplot(x=[r + barWidth/2 for r in r3], y=top3, color='#f5a623', marker='o', label='top3')

# # Annotate bars with values
# for bar in bars1:
#     yval = bar.get_height()
#     plt.text(bar.get_x() + bar.get_width()/2, yval, round(yval, 2), ha='center', va='bottom')
# for bar in bars2:
#     yval = bar.get_height()
#     plt.text(bar.get_x() + bar.get_width()/2, yval, round(yval, 2), ha='center', va='bottom')
# for bar in bars3:
#     yval = bar.get_height()
#     plt.text(bar.get_x() + bar.get_width()/2, yval, round(yval, 2), ha='center', va='bottom')

# plt.xlabel('Map size', fontweight='bold')
# plt.xticks([r + barWidth for r in range(len(map_sizes))], map_sizes)
# plt.legend()
# plt.show()