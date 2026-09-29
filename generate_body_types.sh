#!/bin/bash

# Array of body types
body_types=(
  "hatchback"
  "sedan"
  "wagon"
  "coupe"
  "convertible"
  "suv_crossover"
  "mpv_van"
  "pickup"
  "liftback"
  "city_car"
  "shooting_brake"
)

# Output directory
out_dir="carpaintr-front/public/body_types"
mkdir -p "$out_dir"

for body_type in "${body_types[@]}"; do
    # Convert underscores to spaces for the prompt
    clean_body_type=$(echo "$body_type" | tr '_' ' ')
    echo "Generating image for $body_type..."
    
    prompt="A minimalist, clean flat vector illustration of a generic silver (gray) $clean_body_type car on a pure solid white background. Side profile view. No text, no background."
    
    /Users/vedmedik/dev/offloadmq/oai/cli/oai image generate "$prompt" -o "$out_dir/$body_type.jpg" -capability imggen.z_image_turbo
done

echo "Done generating body types."
