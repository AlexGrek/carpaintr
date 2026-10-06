import { useState } from "react";
import { getCarModelImage } from "../utils/carModelImages";

/**
 * Photo of a catalog car model; renders nothing when the model has no photo.
 * Photos are square with a white background, so object-cover crops evenly.
 */
const CarModelImage = ({ make, model, className = "", style, testId }) => {
  const src = getCarModelImage(make, model);
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;
  return (
    <img
      src={src}
      alt={`${make} ${model}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
      className={`bg-white object-cover ${className}`}
      style={style}
      data-testid={testId}
    />
  );
};

export default CarModelImage;
