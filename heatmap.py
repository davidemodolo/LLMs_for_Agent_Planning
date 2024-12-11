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
        if label == "PICKUP":
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
'D': 0.8744592772277636,
'R': 0.09168143721742084
},
{
'D': 0.9204125376796807
},
{
'D': 0.6409207000455684,
'R': 0.2792282900742623
},
{
'D': 0.7683680895638543,
'R': 0.17179977980935932
},
{
'D': 0.6675399776913973,
'R': 0.22117274591673186
},
{
'D': 0.526055867413674,
'L': 0.21073049646567263,
'U': 0.10004790118307458,
'R': 0.0960842527008502
},
{
'R': 0.4537744183814276,
'U': 0.26937673181045335,
'D': 0.1842493557668505
},
{
'PICKUP': 1
},
{
'L': 0.6449431769165592,
'U': 0.24838881872636456
},
{
'U': 0.7240179931322405,
'D': 0.10798546440941836,
'L': 0.08268178239241625
},
{
'U': 0.8347481503730149
},
{
'U': 0.5787276016078792,
'L': 0.2577341389034301,
'D': 0.080534024732989
},

]
width = 3
length = 4
color = 'green'
create_table_of_square_pies(data_list, width, length, color, title='GPT-4o-mini, 3x4 pickup')