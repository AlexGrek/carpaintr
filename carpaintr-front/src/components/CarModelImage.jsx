import { useState } from "react";
import { getCarModelImage } from "../utils/carModelImages";

/**
 * Photo of a catalog car model; renders nothing when the model has no photo.
 * Keep the complete square photo visible in thumbnails and larger previews.
 */
const CarModelImage = ({ make, model, className = "", style, testId }) => {
  const src = getCarModelImage(make, model);
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;
  return (
    <img
      src={src}
      alt={`${make} ${model}`}
      width={256}
      height={256}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
      className={`bg-white object-contain ${className}`}
      style={style}
      data-testid={testId}
    />
  );
};

export default CarModelImage;
