#!/bin/bash

# Array of specific body types
body_types=(
  "hatchback 3 doors"
  "hatchback 5 doors"
  "suv 3 doors"
  "suv 5 doors"
  "cabriolet"
)

out_dir="carpaintr-front/public/body_types"

for body_type in "${body_types[@]}"; do
    echo "Generating image for $body_type..."
    prompt="A minimalist, clean flat vector illustration of a generic silver (gray) $body_type car on a pure solid white background. Side profile view. No text, no background."
    /Users/vedmedik/dev/offloadmq/oai/cli/oai image generate "$prompt" -o "$out_dir/$body_type.jpg" -capability imggen.z_image_turbo
done

echo "Done generating more body types."
