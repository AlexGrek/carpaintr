import { useEffect, useState } from "react";
import { getCarModelImage } from "../utils/carModelImages";
import { authFetchYaml } from "../utils/authFetch";
import { carImageColor } from "../utils/carImageColor";

/**
 * Photo of a catalog car model; renders nothing when the model has no photo.
 * Keep the complete square photo visible in thumbnails and larger previews.
 */
const CarModelImage = ({ make, model, paintColor, className = "", style, testId }) => {
  const [colors, setColors] = useState(null);
  useEffect(() => {
    if (!paintColor) return;
    let active = true;
    authFetchYaml("/api/v1/user/global/colors.json").then((data) => {
      if (active) setColors(data?.rows?.flat() ?? []);
    });
    return () => { active = false; };
  }, [paintColor]);
  const src = getCarModelImage(make, model, carImageColor(paintColor, colors));
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
