#!/bin/bash

brands=("audi" "seat" "skoda" "volkswagen")
out_dir="carpaintr-front/public/brands"
mkdir -p "$out_dir"

for brand in "${brands[@]}"; do
    echo "Generating logo for $brand..."
    prompt="High resolution, precise and accurate official 2D flat logo emblem of the $brand car brand. Solid pure white background. Centered. Crisp edges, professional clean vector style."
    /Users/vedmedik/dev/offloadmq/oai/cli/oai image generate "$prompt" -o "$out_dir/$brand.png" -capability imggen.z_image_turbo
done

echo "Done."
