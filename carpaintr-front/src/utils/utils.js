export function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
};

export const handleOpenNewTab = (path) => {
  window.open(path, '_blank', 'noreferrer');
};

export const stripExt = (filename) => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
};