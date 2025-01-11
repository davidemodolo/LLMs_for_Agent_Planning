import matplotlib.pyplot as plt
import matplotlib.patches as patches

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
    print(x, y)
    print(values)

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


def create_table_of_square_pies(data_list, width, length, color, title):
    if len(data_list) > width * length:
        raise ValueError("The number of data dictionaries exceeds the available table cells.")

    fig, axes = plt.subplots(length, width, figsize=(min(width * 2, 10), min(length * 2, 10)))
    if length > 1 and width > 1:
        axes = axes.flatten()
    elif length == 1 or width == 1:
        axes = [axes]  # Ensure it's always iterable
    count = 0
    for i, data in enumerate(data_list):
        values = data['values']
        create_square_pie(axes[i], values, color, data["x"], data["y"])
        count += 1
    print(count)

    fig.suptitle(title, fontsize=16)
    plt.tight_layout()
    plt.savefig(f"{title}.png")
    plt.show()

json_path = "heatmap.json"
import json
with open(json_path, 'r') as f:
    data_list = json.load(f)
goal = data_list[-5]['goal']
model = data_list[-4]['model']
width = data_list[-3]['w']
height = data_list[-2]['h']
goal_x, goal_y = int(data_list[-1]['goal'][1:].split(',')[0]), int(data_list[-1]['goal'][:-1].split(',')[1])
title = f"{model}, {width}x{height} {goal}"
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
        # print(tile["values"])
        # print(tile["values"][0][1])
        tile['values'] = [tupla for tupla in tile['values'] if tupla[1] == True]
        # print(tile["values"])


create_table_of_square_pies(tiles, width, height, color='green', title=title)