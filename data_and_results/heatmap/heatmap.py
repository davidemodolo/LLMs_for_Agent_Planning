import matplotlib.pyplot as plt
import matplotlib.patches as patches
import math

colors = {
    "U": "#4a90e2",  # blue
    "D": "#e94e77",  # red
    "L": "#7ed321",  # green
    "R": "#f8e71c",  # yellow
    "T": "#bd10e0",  # purple
    "S": "#f5a623"   # orange
}

def create_square_pie(ax, data, color):
    """
    Create a square pie chart within the provided Axes object.

    Parameters:
    ax: Matplotlib Axes object
    data: Dictionary of labels and values for the pie chart
    color: Base color for the pie chart
    """
    total = sum(data.values())*100
    current_pos = 0

    for label, value in data.items():
        sector_size = value*100 / total
        if label == "PICKUP" or label == "DELIVER":
            rect = patches.Rectangle((0, current_pos), 1, sector_size, linewidth=10, edgecolor='grey', facecolor='#ffffff', alpha=sector_size)
        else:
            rect = patches.Rectangle((0, current_pos), 1, sector_size, linewidth=1, facecolor=colors[label], alpha=sector_size)
        ax.add_patch(rect)

        # Add label in the middle of the sector
        ax.text(0.5, current_pos + sector_size / 2, label, ha='center', va='center', fontsize=8, color='black')

        current_pos += sector_size

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

def create_table_of_square_pies(data_list, width, length, color, title):
    """
    Create a table of square pie charts.

    Parameters:
    data_list: List of dictionaries, each representing data for a pie chart
    width: Number of columns in the table
    length: Number of rows in the table
    color: Base color for the pie charts
    """
    if len(data_list) > width * length:
        raise ValueError("The number of data dictionaries exceeds the available table cells.")

    fig, axes = plt.subplots(length, width, figsize=(width * 2, length * 2))
    
    # Flatten axes array if more than one row and column exist
    if length > 1 and width > 1:
        axes = axes.flatten()
    elif length == 1 or width == 1:
        axes = [axes]  # Ensure it's always iterable

    # Fill the table cells with square pie charts
    for i, data in enumerate(data_list):
        create_square_pie(axes[i], data, color)

    # Turn off unused axes
    for j in range(len(data_list), width * length):
        axes[j].axis('off')

    # Add title
    fig.suptitle(title, fontsize=16)
    plt.tight_layout()
    plt.show()

# Example usage
data_list = [
{
'R': 0.9879561627403758
},
{
'D': 0.3131483305218169,
'R': 0.20824318348852833,
'L': 0.15158036560796515,
'U': 0.12470936196420457,
'S': 0.10670329784749905,
'T': 0.09561546056998595
},
{
'DELIVER': 1
},
{
'R': 0.9393138829376697
},
{
'R': 0.9783999729690446
},
{
'U': 0.42417957848672166,
'R': 0.39156578358924105,
'L': 0.08300830400553283
},
{
'U': 0.5585935981457584,
'R': 0.35282501534837835
},
{
'U': 0.6398834083888053,
'L': 0.21778061894258163,
'R': 0.0753612505192328
},

{
'L': 0.8323710932414887,
'U': 0.12188471039973392
},



]
width = 3
length = 3
color = 'green'
create_table_of_square_pies(data_list, width, length, color, title='GPT-4o-mini, 3x4 pickup')