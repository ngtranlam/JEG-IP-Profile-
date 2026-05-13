import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Trash2, Image, Info, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CloneTool() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [downloadBase64, setDownloadBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Ready - Upload images to get started');
  const [progress, setProgress] = useState(0);
  const [resultFitView, setResultFitView] = useState(true);

  // Clone options state
  const [aiModel, setAiModel] = useState('gemini-2.5-flash-image');
  const [outputSize, setOutputSize] = useState('4500x4500');
  const [designType, setDesignType] = useState<'print' | 'embroidery'>('print');
  const [removeBackground, setRemoveBackground] = useState(true);
  const [upscaleEnabled, setUpscaleEnabled] = useState(true);
  const [upscaleScale, setUpscaleScale] = useState(2); // 0=2x, 1=4x, 2=8x
  const [redesignEnabled, setRedesignEnabled] = useState(false);
  const [redesignPrompt, setRedesignPrompt] = useState('');

  // Crop selection state
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  // Natural image dimensions (for mapping crop coords)
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const scaleValues = [2, 4, 8];

  // --- File handling ---
  const loadImage = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPEG, JPG, or GIF)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setCropSelection(null);
      setResultImage(null);
      setDownloadBase64(null);
      setStatusText('Image loaded - Draw crop region or double-click for full image');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  }, [loadImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadImage(file);
  }, [loadImage]);

  // --- Crop canvas overlay logic ---
  const getImageDisplayRect = useCallback(() => {
    const img = originalImageRef.current;
    const container = imageContainerRef.current;
    if (!img || !container) return null;

    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    return {
      offsetX: imgRect.left - containerRect.left,
      offsetY: imgRect.top - containerRect.top,
      displayWidth: imgRect.width,
      displayHeight: imgRect.height,
    };
  }, []);

  // Setup crop canvas dimensions when image loads
  const setupCropCanvas = useCallback(() => {
    const img = originalImageRef.current;
    const canvas = canvasRef.current;
    const container = imageContainerRef.current;
    if (!img || !canvas || !container) return;

    setNaturalWidth(img.naturalWidth);
    setNaturalHeight(img.naturalHeight);

    // Match canvas to container size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    drawCropOverlay();
  }, []);

  // Draw crop selection on canvas
  const drawCropOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!cropSelection) return;

    const rect = getImageDisplayRect();
    if (!rect) return;

    // Convert crop from natural coords to display coords
    const scaleX = rect.displayWidth / naturalWidth;
    const scaleY = rect.displayHeight / naturalHeight;

    const displayX = rect.offsetX + cropSelection.x * scaleX;
    const displayY = rect.offsetY + cropSelection.y * scaleY;
    const displayW = cropSelection.width * scaleX;
    const displayH = cropSelection.height * scaleY;

    // Dim everything outside selection
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear the selection area
    ctx.clearRect(displayX, displayY, displayW, displayH);

    // Draw selection border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(displayX, displayY, displayW, displayH);

    // Draw corner handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#3b82f6';
    const handleSize = 6;
    const corners = [
      [displayX, displayY],
      [displayX + displayW, displayY],
      [displayX, displayY + displayH],
      [displayX + displayW, displayY + displayH],
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    });

    // Size label
    ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
    const label = `${Math.round(cropSelection.width)} × ${Math.round(cropSelection.height)}`;
    ctx.font = '11px sans-serif';
    const textWidth = ctx.measureText(label).width;
    const labelX = displayX + displayW / 2 - textWidth / 2 - 4;
    const labelY = displayY - 22;
    ctx.fillRect(labelX, labelY, textWidth + 8, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, labelX + 4, labelY + 13);
  }, [cropSelection, naturalWidth, naturalHeight, getImageDisplayRect]);

  useEffect(() => {
    drawCropOverlay();
  }, [cropSelection, drawCropOverlay]);

  // Window resize -> redraw
  useEffect(() => {
    const handleResize = () => {
      setupCropCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCropCanvas]);

  // Mouse events for drawing crop selection
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = getImageDisplayRect();
    if (!rect) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    // Check if click is within the image area
    if (
      mouseX >= rect.offsetX &&
      mouseX <= rect.offsetX + rect.displayWidth &&
      mouseY >= rect.offsetY &&
      mouseY <= rect.offsetY + rect.displayHeight
    ) {
      setIsDrawing(true);
      setDrawStart({ x: mouseX, y: mouseY });
      setCropSelection(null);
    }
  }, [getImageDisplayRect]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;

    const rect = getImageDisplayRect();
    if (!rect) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    // Clamp to image bounds
    const clampedX = Math.max(rect.offsetX, Math.min(mouseX, rect.offsetX + rect.displayWidth));
    const clampedY = Math.max(rect.offsetY, Math.min(mouseY, rect.offsetY + rect.displayHeight));

    // Convert from display coords to natural image coords
    const scaleX = naturalWidth / rect.displayWidth;
    const scaleY = naturalHeight / rect.displayHeight;

    const startNatX = (drawStart.x - rect.offsetX) * scaleX;
    const startNatY = (drawStart.y - rect.offsetY) * scaleY;
    const endNatX = (clampedX - rect.offsetX) * scaleX;
    const endNatY = (clampedY - rect.offsetY) * scaleY;

    const x = Math.min(startNatX, endNatX);
    const y = Math.min(startNatY, endNatY);
    const width = Math.abs(endNatX - startNatX);
    const height = Math.abs(endNatY - startNatY);

    if (width > 5 && height > 5) {
      setCropSelection({ x, y, width, height });
    }
  }, [isDrawing, drawStart, naturalWidth, naturalHeight, getImageDisplayRect]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDrawing(false);
    setDrawStart(null);
  }, []);

  // Double click to select entire image
  const handleCanvasDoubleClick = useCallback(() => {
    if (naturalWidth > 0 && naturalHeight > 0) {
      setCropSelection({ x: 0, y: 0, width: naturalWidth, height: naturalHeight });
      setStatusText('Full image selected - Ready to extract');
    }
  }, [naturalWidth, naturalHeight]);

  // --- Extract ---
  const handleExtract = useCallback(async () => {
    if (!uploadedImage) return;
    if (!cropSelection) {
      alert('Please select an area on the image by dragging, or double-click to select the entire image!');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusText('Starting extraction...');
    setResultImage(null);
    setDownloadBase64(null);

    try {
      // Convert data URL to base64 (strip prefix)
      const base64Data = uploadedImage.split(',')[1];

      const result = await window.electronAPI.designToolExtract({
        imageBase64: base64Data,
        outputSize,
        designType,
        removeBackground,
        upscaleEnabled,
        upscaleScale: scaleValues[upscaleScale],
        redesignEnabled,
        redesignPrompt,
        aiModel,
        cropCoordinates: {
          x: Math.round(cropSelection.x),
          y: Math.round(cropSelection.y),
          width: Math.round(cropSelection.width),
          height: Math.round(cropSelection.height),
        },
      });

      if (result.success) {
        setResultImage(`data:image/png;base64,${result.imageBase64}`);
        setDownloadBase64(result.downloadBase64 || result.imageBase64);
        setStatusText(`Processing completed in ${((result.processingTime || 0) / 1000).toFixed(1)}s`);
        setProgress(100);

        // Track usage to report API (fire-and-forget)
        window.electronAPI.reportTrackUsage('clone', {
          remove_background: removeBackground,
          upscale_enabled: upscaleEnabled,
        }).then((r: any) => console.log('[ReportAPI] clone track:', r)).catch((e: any) => console.warn('[ReportAPI] clone track error:', e));
      } else {
        setStatusText(`Error: ${result.error || 'Unknown error'}`);
        setProgress(0);
      }
    } catch (err: any) {
      console.error('Extract error:', err);
      setStatusText(`Error: ${err.message || 'Extraction failed'}`);
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedImage, cropSelection, outputSize, designType, removeBackground, upscaleEnabled, upscaleScale, redesignEnabled, redesignPrompt, aiModel]);

  // --- Download ---
  const handleDownload = useCallback(async () => {
    if (!downloadBase64) return;
    try {
      const result = await window.electronAPI.designToolSaveResult(
        downloadBase64,
        `clone_result_${Date.now()}.png`
      );
      if (result.success) {
        setStatusText(`Saved to: ${result.filePath}`);
      }
    } catch (err: any) {
      console.error('Save error:', err);
    }
  }, [downloadBase64]);

  // --- Clear ---
  const handleClearAll = () => {
    setUploadedImage(null);
    setUploadedFile(null);
    setUploadedFileName('');
    setResultImage(null);
    setDownloadBase64(null);
    setIsProcessing(false);
    setStatusText('Ready - Upload images to get started');
    setProgress(0);
    setCropSelection(null);
    setNaturalWidth(0);
    setNaturalHeight(0);
    setAiModel('gemini-2.5-flash-image');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800">Clone - AI Design Tool</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* AI Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model:</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="gemini-2.5-flash-image">Nano Banana 2</option>
                <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1 italic">
                {aiModel === 'gemini-2.5-flash-image'
                  ? 'Tốc độ xử lý nhanh, ít lỗi, phù hợp với design đơn giản'
                  : 'Xử lý chi tiết tốt, tốc độ chậm hơn, có thể lỗi nếu design có mặt người, watermark bản quyền'}
              </p>
            </div>

            {/* Output Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Output Size:</label>
              <select
                value={outputSize}
                onChange={(e) => setOutputSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="4500x4500">4500 x 4500 px</option>
                <option value="4500x5400">4500 x 5400 px</option>
                <option value="1500x1500">1500 x 1500 px</option>
                <option value="3000x3000">3000 x 3000 px</option>
                <option value="3300x5100">3300 x 5100 px</option>
              </select>
            </div>

            {/* Design Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Design Type:</label>
              <select
                value={designType}
                onChange={(e) => setDesignType(e.target.value as 'print' | 'embroidery')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="print">Print</option>
                <option value="embroidery">Embroidery</option>
              </select>
            </div>

            {/* Remove Background Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Remove Background</label>
              <button
                onClick={() => setRemoveBackground(!removeBackground)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  removeBackground ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  removeBackground ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Upscale Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Upscale</label>
                <button
                  onClick={() => setUpscaleEnabled(!upscaleEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    upscaleEnabled ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    upscaleEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Scale Slider */}
              {upscaleEnabled && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Scale Factor</span>
                    <span className="text-xs font-semibold text-blue-600">{scaleValues[upscaleScale]}x</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    value={upscaleScale}
                    onChange={(e) => setUpscaleScale(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-gray-400">2x</span>
                    <span className="text-[11px] text-gray-400">4x</span>
                    <span className="text-[11px] text-gray-400">8x</span>
                  </div>
                </div>
              )}
            </div>

            {/* Redesign Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Redesign</label>
                <button
                  onClick={() => setRedesignEnabled(!redesignEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    redesignEnabled ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    redesignEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {redesignEnabled && (
                <div className="mt-3">
                  <textarea
                    value={redesignPrompt}
                    onChange={(e) => setRedesignPrompt(e.target.value)}
                    placeholder="Enter redesign prompt..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-vertical min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white space-y-2">
            <button
              onClick={handleExtract}
              disabled={!uploadedImage || isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
              {isProcessing ? 'Processing...' : 'Extract Design'}
            </button>
            <button
              onClick={handleClearAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Preview Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Preview Comparison</h2>
            <div className="flex items-center gap-3">
              {uploadedFileName && (
                <span className="text-xs text-gray-500">{uploadedFileName}</span>
              )}
              {cropSelection && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Crop: {Math.round(cropSelection.width)} × {Math.round(cropSelection.height)}
                </span>
              )}
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 px-4 pb-2 overflow-hidden">
            <div className="h-full flex gap-4">
              {/* Original Image Panel with Crop Overlay */}
              <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-20">
                  Original
                </div>
                {uploadedImage && (
                  <div className="absolute top-2.5 right-3 bg-blue-500/80 text-white px-2 py-1 rounded text-[10px] z-20">
                    Drag to crop · Dbl-click for full
                  </div>
                )}
                {uploadedImage ? (
                  <div ref={imageContainerRef} className="relative w-full h-full flex items-center justify-center">
                    <img
                      ref={originalImageRef}
                      src={uploadedImage}
                      alt="Original"
                      className="max-w-full max-h-full object-contain"
                      onLoad={setupCropCanvas}
                      draggable={false}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 cursor-crosshair z-10"
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      onDoubleClick={handleCanvasDoubleClick}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-sky-300 rounded-lg bg-gray-50 cursor-pointer hover:border-sky-400 hover:bg-blue-50/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-12 w-12 text-sky-300 opacity-60 mb-4" />
                    <h3 className="text-base text-gray-400 mb-2">Upload Image</h3>
                    <p className="text-sm text-gray-300 mb-1">Drag & drop or click to browse</p>
                    <p className="text-xs text-gray-300">Max size: 10MB</p>
                  </div>
                )}
              </div>

              {/* Result Image Panel */}
              <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10">
                  Result
                </div>
                {resultImage && (
                  <button
                    onClick={() => setResultFitView(!resultFitView)}
                    className="absolute top-2.5 right-3 bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded text-xs z-10 flex items-center gap-1 transition-colors"
                  >
                    {resultFitView ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                    {resultFitView ? 'Actual Size' : 'Fit'}
                  </button>
                )}
                {resultImage ? (
                  <div className={`w-full h-full flex ${resultFitView ? 'items-center justify-center' : 'items-start justify-start'} overflow-auto`}>
                    <img
                      src={resultImage}
                      alt="Result"
                      className={resultFitView ? 'max-w-full max-h-full object-contain' : ''}
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-300">
                    <Image className="h-12 w-12 opacity-40 mb-4" />
                    <p className="text-base opacity-60">No result yet</p>
                    <p className="text-sm opacity-50 mt-1">Upload and extract to see result</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 mx-4 mb-3 px-4 py-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                ) : resultImage ? (
                  <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-[10px]">✓</span>
                  </div>
                ) : (
                  <Info className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-600">{statusText}</span>
              </div>
              <div className="flex gap-2">
                {downloadBase64 && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                )}
              </div>
            </div>
            {isProcessing && (
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
