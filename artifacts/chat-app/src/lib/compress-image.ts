export async function compressImage(file: File, maxKB = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1280;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        const tryCompress = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
          if (sizeKB <= maxKB || quality <= 0.1) { resolve(dataUrl); return; }
          quality -= 0.1;
          tryCompress();
        };
        tryCompress();
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
