"use client";
import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";

interface AvatarCropperModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: (blob: Blob) => void;
}

function getCroppedBlob(imageSrc: string, pixelCrop: { width: number; height: number; x: number; y: number; }) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context not available"));

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Failed to create blob"));
        resolve(blob);
      }, "image/jpeg", 0.92);
    };
    image.onerror = (e) => reject(e);
  });
}

export default function AvatarCropperModal({ imageSrc, isOpen, onClose, onApply }: AvatarCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ width: number; height: number; x: number; y: number } | null>(null);

  const onCropComplete = useCallback((
    _croppedArea: { width: number; height: number; x: number; y: number },
    croppedAreaPixelsParam: { width: number; height: number; x: number; y: number }
  ) => {
    setCroppedAreaPixels(croppedAreaPixelsParam);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onApply(blob);
      onClose();
    } catch (e) {
      console.error("Failed to crop image", e);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isFullscreen={true}>
      <div className="relative w-full overflow-hidden rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-6">
        <h4 className="mb-3 text-xl font-semibold text-gray-800 dark:text-white/90">Crop Foto Profil</h4>
        <div className="relative h-[360px] w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
              cropShape="round"
            />
          )}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={onClose}>Batal</Button>
            <Button size="sm" onClick={handleApply}>Apply</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
