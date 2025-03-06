import tiktoken
from PIL import Image, ImageDraw, ImageFont
import random

def get_token_colors(tokens):
    """Assign a unique color to each unique token."""
    unique_tokens = list(set(tokens))
    random.seed(42)  # Ensure consistent colors across runs
    colors = {
        token: (random.randint(50, 200), random.randint(50, 200), random.randint(50, 200))
        for token in unique_tokens
    }
    return colors

def render_sentence(sentence, background_color=(255, 255, 255), font_path="arial.ttf"):
    """
    Render an image with tokens highlighted in different colors.
    
    Each token is rendered in a larger font, with a smaller token number drawn below.
    A small margin is added to the colored box so it fully covers the token text.
    """
    encoding = tiktoken.encoding_for_model("gpt-4o")
    tokens = encoding.encode(sentence)
    decoded_tokens = [encoding.decode([token]) for token in tokens]
    token_colors = get_token_colors(tokens)
    
    # Font sizes and layout settings
    token_font_size = 40   # Larger text for tokens
    number_font_size = 20  # Smaller text for token numbers
    token_spacing = 5     # Horizontal space between tokens
    padding = 20           # Overall image padding
    gap = 5                # Vertical gap between token text and token number
    margin = 2             # Extra margin for the colored box
    
    # Load fonts
    try:
        token_font = ImageFont.truetype(font_path, token_font_size)
    except Exception as e:
        token_font = ImageFont.load_default()
    try:
        number_font = ImageFont.truetype(font_path, number_font_size)
    except Exception as e:
        number_font = ImageFont.load_default()
    
    # Create a dummy image to measure text sizes.
    dummy_img = Image.new("RGB", (1, 1))
    dummy_draw = ImageDraw.Draw(dummy_img)
    
    # Compute metrics for each token
    token_metrics = []
    for token in decoded_tokens:
        bbox_text = dummy_draw.textbbox((0, 0), token, font=token_font)
        token_width = bbox_text[2] - bbox_text[0]
        print(token_width)
        token_height = 45
        print(token_height)
        print()
        bbox_num = dummy_draw.textbbox((0, 0), "0", font=number_font)
        number_height = bbox_num[3] - bbox_num[1]
        total_height = token_height + gap + number_height
        token_metrics.append((token_width, token_height, number_height, total_height))
    
    # Compute overall image dimensions
    total_width = sum(metrics[0] for metrics in token_metrics) \
                  + token_spacing * (len(token_metrics) - 1) + 2 * padding
    total_height = max(metrics[3] for metrics in token_metrics) + 2 * padding
    
    # Create the final image
    image = Image.new("RGB", (total_width, total_height), background_color)
    draw = ImageDraw.Draw(image)
    
    x = padding
    for token, token_id, metrics in zip(decoded_tokens, tokens, token_metrics):
        token_width, token_height, number_height, total_token_height = metrics
        # Draw a background rectangle for the token text
        rect_x0 = x - margin
        rect_y0 = padding - margin
        rect_x1 = x + token_width + margin
        rect_y1 = padding + token_height + margin
        draw.rectangle([rect_x0, rect_y0, rect_x1, rect_y1], fill=token_colors[token_id])
        
        # Draw the token text
        draw.text((x, padding), token, fill=(0, 0, 0), font=token_font)
        
        # Center the token number below the token text
        token_number = str(token_id)
        bbox_number = draw.textbbox((0, 0), token_number, font=number_font)
        number_width = bbox_number[2] - bbox_number[0]
        number_x = x + (token_width - number_width) / 2
        number_y = padding + token_height + gap
        draw.text((number_x, number_y), token_number, fill=(0, 0, 0), font=number_font)
        
        x += token_width + token_spacing
    
    return image

if __name__ == "__main__":
    sentence = "Esempio di tokenizzazione di una frase tramite il tokenizer di GPT-4o."
    image = render_sentence(sentence)
    image.show()  # Open the image in the default viewer
    image.save("tokenized_sentence.png")  # Save the image to a file
