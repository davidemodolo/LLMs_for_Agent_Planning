import matplotlib.pyplot as plt
import matplotlib.patches as patches
import json
import time
import os

colors = {
    "U": "#4a90e2",  # blue
    "D": "#e94e77",  # red
    "L": "#7ed321",  # green
    "R": "#f8e71c",  # yellow
    "T": "#bd10e0",  # purple
    "S": "#f5a623"   # orange
}

def create_square_pie(ax, values, color, x, y):
    total = sum(value for _, _, value in values)
    current_pos = 0

    for label, _, value in values:
        sector_size = value / total
        rect = patches.Rectangle(
                (0, current_pos), 1, sector_size, linewidth=4, edgecolor='black', 
                facecolor=colors[label] if label in colors else "white", alpha=sector_size
            )

        ax.add_patch(rect)

        ax.text(
            0.5, current_pos + sector_size / 2, label, 
            ha='center', va='center', fontsize=8, color='black'
        )

        current_pos += sector_size

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')


def create_table_of_square_pies(data_list, width, length, color, title, save_path):
    if len(data_list) > width * length:
        raise ValueError("The number of data dictionaries exceeds the available table cells.")

    fig, axes = plt.subplots(length, width, figsize=(min(width * 2, 10), min(length * 2, 10)))
    if length > 1 and width > 1:
        axes = axes.flatten()
    elif length == 1 or width == 1:
        axes = [axes]  # Ensure it's always iterable
    for i, data in enumerate(data_list):
        values = data['values']
        create_square_pie(axes[i], values, color, data["x"], data["y"])

    fig.suptitle(title, fontsize=16)
    plt.tight_layout()
    plt.savefig(os.path.join(save_path, f"{title}.png"))
    plt.show()

json_path = "heatmap.json"
with open(json_path, 'r') as f:
    data_list = json.load(f)
goal = data_list[-5]['goal']
model = data_list[-4]['model']
width = data_list[-3]['w']
height = data_list[-2]['h']
goal_x, goal_y = int(data_list[-1]['goal'][1:].split(',')[0]), int(data_list[-1]['goal'][:-1].split(',')[1])
current_time = time.strftime("%Y%m%d-%H%M%S")
path_to_save_data = f"data_and_results/heatmap/heatmaps/{model}/{width}x{height}_map/{goal}/pos_{goal_x}_{goal_y}/{current_time}/"
os.makedirs(path_to_save_data, exist_ok=True)
print(width, height, goal_x, goal_y)
tiles = data_list[:-5]
print(tiles[0])
# sort the tiles by x and y
tiles = sorted(tiles, key=lambda x: (x['x'], x['y']))
# change the values of the tile with x = goal_x and y = goal_y to GOAL, otherwise keep only the values where values[1] == True
for tile in tiles:
    if tile['x'] == goal_x and tile['y'] == goal_y:
        tile['values'] = [(goal.upper(), True, 1)]
    else:
        # keep only the values where values[1] == True
        tile['values'] = [tupla for tupla in tile['values'] if tupla[1] == True]

create_table_of_square_pies(tiles, width, height, color='green', title="actions_heatmap", save_path=path_to_save_data)

# Part 2: 
# For each tile, find which moves are correct and sum them
# TODO: RESCALE THE PERCENTAGES
percentages = []
for tile in tiles:
    delta_y = goal_y - tile['y']
    delta_x = goal_x - tile['x']
    correct_moves = []
    if delta_x > 0:
        correct_moves.append('D')
    if delta_x < 0:
        correct_moves.append('U')
    if delta_y > 0:
        correct_moves.append('R')
    if delta_y < 0:
        correct_moves.append('L')
    print(tile['x'], tile['y'], correct_moves, tile['values'])
    percentage = 0
    # HERE RESCALE THE PERCENTAGES
    for value in tile['values']:
        if value[0] in correct_moves:
            percentage += value[2]
    total_percentage = sum([value[2] for value in tile['values']])
    percentage = percentage / total_percentage
    print(percentage)
    percentages.append((tile['x'], tile['y'], percentage, tile['values'], correct_moves))

# new function that just prints the percentages in the squares
def create_square(ax, value, color, x, y):
    import matplotlib.colors as mcolors

    norm = mcolors.Normalize(vmin=0, vmax=1)
    cmap = plt.get_cmap('RdYlGn')
    color = cmap(norm(value))
    rect = patches.Rectangle(
            (0, 0), 1, 1, linewidth=4, edgecolor='black', 
            facecolor=color
        )
    rect.set_facecolor(mcolors.to_rgba(color, alpha=min(1, value*2)))

    ax.add_patch(rect)

    ax.text(
        0.5, 0.5, f"{goal.upper()}" if x == goal_x and y == goal_y else f"{value*100:.2f}%", 
        ha='center', va='center', fontsize=8, color='black'
    )

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

def create_table_of_squares(data_list, width, length, color, title, save_path):
    if len(data_list) > width * length:
        raise ValueError("The number of data dictionaries exceeds the available table cells.")

    fig, axes = plt.subplots(length, width, figsize=(min(width * 2, 10), min(length * 2, 10)))
    if length > 1 and width > 1:
        axes = axes.flatten()
    elif length == 1 or width == 1:
        axes = [axes]  # Ensure it's always iterable
    for i, data in enumerate(data_list):
        value = data[2]
        create_square(axes[i], value, color, data[0], data[1])

    fig.suptitle(title, fontsize=16)
    plt.tight_layout()
    plt.savefig(os.path.join(save_path, f"{title}_PERC.png"))
    plt.show()

create_table_of_squares(percentages, width, height, color='green', title="correct_actions_percentage", save_path=path_to_save_data)

# Part 3:
# For each tile, compute when a correct move is in the top1, top2 and top3 actions and count overall the percentage of correct moves in the top1, top2 and top3 actions
count_top1 = 0
count_top2 = 0
count_top3 = 0
for entry in percentages:
    x,y,_,moves,correct_moves = entry
    print(moves, correct_moves)
    # if goal tile ignore
    if x == goal_x and y == goal_y:
        continue
    # is any of the correct moves in the first move?
    found_top1, found_top2 = False, False
    for correct_move in correct_moves:
        if moves[0][0] == correct_move:
            count_top1 += 1
            count_top2 += 1
            count_top3 += 1
            found_top1 = True
            break
    if not found_top1 and len(moves) > 1:
        for correct_move in correct_moves:
            if moves[1][0] == correct_move:
                count_top2 += 1
                count_top3 += 1
                found_top2 = True
                break
    if not found_top1 and not found_top2 and len(moves) > 2:
        for correct_move in correct_moves:
            if moves[2][0] == correct_move:
                count_top3 += 1
                break
print(count_top1, count_top2, count_top3)
num_tiles_not_goal = len(percentages) - 1
print(count_top1/num_tiles_not_goal, count_top2/num_tiles_not_goal, count_top3/num_tiles_not_goal)

results = {
    "count_top1": count_top1,
    "count_top2": count_top2,
    "count_top3": count_top3,
    "percentage_top1": count_top1 / num_tiles_not_goal,
    "percentage_top2": count_top2 / num_tiles_not_goal,
    "percentage_top3": count_top3 / num_tiles_not_goal
}

output_path = os.path.join(path_to_save_data, "topX_values.json")
with open(output_path, 'w') as f:
    json.dump(results, f, indent=4)

print(f"Results saved to {output_path}")
