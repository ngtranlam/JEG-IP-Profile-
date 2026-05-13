import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Upload, Download, Trash2, Image, Info, Loader2, Wand2, Maximize, Move, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';

export function ImageGenTool() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [downloadBase64, setDownloadBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Ready - Upload images to get started');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [progress, setProgress] = useState(0);

  // Image Gen options state
  const [platform, setPlatform] = useState('etsy');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16'>('1:1');
  const [processingType, setProcessingType] = useState<'print' | 'embroidery'>('print');
  const [mockupSide, setMockupSide] = useState<'front' | 'back'>('front');
  const [modelEnabled, setModelEnabled] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [pose, setPose] = useState<'standing' | 'sitting'>('standing');
  const [ageRange, setAgeRange] = useState('20-35');
  const [customPrompt, setCustomPrompt] = useState('');
  const [mockupType, setMockupType] = useState('tshirt');
  const [color, setColor] = useState('random');

  // Reference image
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  // Image positioning state for aspect ratio frame
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const frameContainerRef = useRef<HTMLDivElement>(null);
  const originalPanelRef = useRef<HTMLDivElement>(null);

  // Compute frame size based on aspect ratio and available container space
  const [frameSize, setFrameSize] = useState({ width: 300, height: 300 });

  const updateFrameSize = useCallback(() => {
    const panel = originalPanelRef.current;
    if (!panel) return;
    const cw = panel.clientWidth - 20;
    const ch = panel.clientHeight - 20;
    let w: number, h: number;
    if (aspectRatio === '1:1') {
      const size = Math.min(cw, ch, 500);
      w = h = size;
    } else {
      const maxH = Math.min(ch, 600);
      h = maxH;
      w = h * (9 / 16);
      if (w > cw) { w = cw; h = w * (16 / 9); }
    }
    setFrameSize({ width: Math.round(w), height: Math.round(h) });
  }, [aspectRatio]);

  useEffect(() => {
    updateFrameSize();
    const handleResize = () => updateFrameSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateFrameSize]);

  // Fit image to frame (show entire image)
  const fitImageToFrame = useCallback(() => {
    if (!naturalSize.width || !naturalSize.height) return;
    const sx = frameSize.width / naturalSize.width;
    const sy = frameSize.height / naturalSize.height;
    const s = Math.min(sx, sy);
    const dw = naturalSize.width * s;
    const dh = naturalSize.height * s;
    setImageScale(s);
    setImagePosition({ x: (frameSize.width - dw) / 2, y: (frameSize.height - dh) / 2 });
  }, [naturalSize, frameSize]);

  // Fill image to frame (cover entire frame)
  const fillImageToFrame = useCallback(() => {
    if (!naturalSize.width || !naturalSize.height) return;
    const sx = frameSize.width / naturalSize.width;
    const sy = frameSize.height / naturalSize.height;
    const s = Math.max(sx, sy);
    const dw = naturalSize.width * s;
    const dh = naturalSize.height * s;
    setImageScale(s);
    setImagePosition({ x: (frameSize.width - dw) / 2, y: (frameSize.height - dh) / 2 });
  }, [naturalSize, frameSize]);

  const resetImagePosition = useCallback(() => {
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
  }, []);

  // Auto-fit when image loads or aspect ratio changes
  useEffect(() => {
    if (uploadedImage && naturalSize.width > 0) {
      fitImageToFrame();
    }
  }, [frameSize, naturalSize, fitImageToFrame, uploadedImage]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      const dataUrl = ev.target?.result as string;
      setUploadedImage(dataUrl);
      setUploadedFileName(file.name);
      setStatusText(`Image loaded in ${aspectRatio} frame - Ready to generate`);
      setStatusType('success');
      // Get natural dimensions
      const img = new window.Image();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [aspectRatio]);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReferenceImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedImage(dataUrl);
      setUploadedFileName(file.name);
      setStatusText(`Image loaded in ${aspectRatio} frame - Ready to generate`);
      setStatusType('success');
      const img = new window.Image();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [aspectRatio]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  }, [imagePosition]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setImagePosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setImageScale(prev => Math.max(0.1, Math.min(5, prev * factor)));
  }, []);

  const handleGenerate = async () => {
    if (!uploadedImage) return;
    setIsProcessing(true);
    setProgress(10);
    setStatusText('Uploading image...');
    setStatusType('info');
    setResultImage(null);
    setDownloadBase64(null);

    try {
      // Extract base64 from data URL
      const base64 = uploadedImage.split(',')[1];

      // Parse age range
      const ageMatch = ageRange.match(/^(\d+)-(\d+)$/);
      const ageMin = ageMatch ? parseInt(ageMatch[1]) : 20;
      const ageMax = ageMatch ? parseInt(ageMatch[2]) : 35;

      // Prepare reference image base64 if provided
      let refBase64: string | undefined;
      if (referenceImage && modelEnabled) {
        refBase64 = referenceImage.split(',')[1];
      }

      setProgress(20);
      setStatusText(`Generating ${mockupType} image for ${platform}...`);

      const result = await (window as any).electronAPI.imageGenGenerate({
        imageBase64: base64,
        platform,
        aspectRatio,
        processingType,
        mockupSide,
        modelEnabled,
        gender,
        pose,
        ageMin,
        ageMax,
        customPrompt: customPrompt.trim(),
        mockupType,
        color,
        referenceImageBase64: refBase64,
        frameWidth: frameSize.width,
        frameHeight: frameSize.height,
        imagePositionX: imagePosition.x,
        imagePositionY: imagePosition.y,
        imageScale,
      });

      if (result.success) {
        setResultImage(`data:image/png;base64,${result.imageBase64}`);
        setDownloadBase64(result.downloadBase64 || result.imageBase64);
        setProgress(100);
        setStatusText('Processing completed successfully!');
        setStatusType('success');

        // Track usage to report API (fire-and-forget)
        (window as any).electronAPI.reportTrackUsage('mockup', {
          remove_background: false,
          upscale_enabled: false,
        }).catch(() => {});
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[ImageGen] Failed:', error);
      setStatusText(error.message || 'Error occurred during processing');
      setStatusType('error');
      setProgress(100);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadBase64) return;
    try {
      const result = await (window as any).electronAPI.designToolSaveResult(downloadBase64, `imagegen_${Date.now()}.png`);
      if (result.success) {
        setStatusText(`Saved to ${result.filePath}`);
        setStatusType('success');
      }
    } catch (err: any) {
      console.error('[ImageGen] Save failed:', err);
    }
  };

  const handleClearAll = () => {
    setUploadedImage(null);
    setUploadedFileName('');
    setResultImage(null);
    setDownloadBase64(null);
    setReferenceImage(null);
    setIsProcessing(false);
    setStatusText('Ready - Upload images to get started');
    setStatusType('info');
    setProgress(0);
    setNaturalSize({ width: 0, height: 0 });
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (refFileInputRef.current) refFileInputRef.current.value = '';
  };

  // Compute displayed image dimensions
  const displayWidth = naturalSize.width * imageScale;
  const displayHeight = naturalSize.height * imageScale;

  // Reference image frame size matches aspect ratio
  const refSize = useMemo(() => {
    if (aspectRatio === '9:16') return { width: 67, height: 120 };
    return { width: 120, height: 120 };
  }, [aspectRatio]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800">Image Gen - AI Design Tool</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={handleFileUpload} />
            <input ref={refFileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={handleRefUpload} />

            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platform:</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="etsy">Etsy</option>
                <option value="tiktok">TikTok Shop</option>
              </select>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAspectRatio('1:1')}
                  className={`flex-1 px-3 py-2 border-2 rounded-md text-xs font-medium transition-all ${
                    aspectRatio === '1:1'
                      ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}
                >
                  1:1 Square
                </button>
                <button
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex-1 px-3 py-2 border-2 rounded-md text-xs font-medium transition-all ${
                    aspectRatio === '9:16'
                      ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}
                >
                  9:16 Portrait
                </button>
              </div>
            </div>

            {/* Processing Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Processing Type:</label>
              <div className="flex gap-4">
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" checked={processingType === 'print'} onChange={() => setProcessingType('print')} className="mr-2" />
                  Print
                </label>
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" checked={processingType === 'embroidery'} onChange={() => setProcessingType('embroidery')} className="mr-2" />
                  Embroidery
                </label>
              </div>
            </div>

            {/* Image Side */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image Side:</label>
              <div className="flex gap-4">
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" checked={mockupSide === 'front'} onChange={() => setMockupSide('front')} className="mr-2" />
                  Front
                </label>
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" checked={mockupSide === 'back'} onChange={() => setMockupSide('back')} className="mr-2" />
                  Back
                </label>
              </div>
            </div>

            {/* Model Option */}
            <div>
              <label className="flex items-center text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={modelEnabled}
                  onChange={(e) => setModelEnabled(e.target.checked)}
                  className="mr-2"
                />
                <span className="font-medium text-gray-700">Model</span>
              </label>

              {modelEnabled && (
                <div className="ml-5 mt-3 space-y-3 border-l-2 border-gray-200 pl-3">
                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gender:</label>
                    <div className="flex gap-4">
                      <label className="flex items-center text-sm cursor-pointer">
                        <input type="radio" checked={gender === 'male'} onChange={() => setGender('male')} className="mr-1.5" />
                        Male
                      </label>
                      <label className="flex items-center text-sm cursor-pointer">
                        <input type="radio" checked={gender === 'female'} onChange={() => setGender('female')} className="mr-1.5" />
                        Female
                      </label>
                    </div>
                  </div>

                  {/* Pose */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Pose:</label>
                    <div className="flex gap-4">
                      <label className="flex items-center text-sm cursor-pointer">
                        <input type="radio" checked={pose === 'standing'} onChange={() => setPose('standing')} className="mr-1.5" />
                        Standing
                      </label>
                      <label className="flex items-center text-sm cursor-pointer">
                        <input type="radio" checked={pose === 'sitting'} onChange={() => setPose('sitting')} className="mr-1.5" />
                        Sitting
                      </label>
                    </div>
                  </div>

                  {/* Age Range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Age Range:</label>
                    <input
                      type="text"
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                      placeholder="e.g., 20-35"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Format: min-max (e.g., 5-10, 20-35)</p>
                  </div>

                  {/* Custom Prompt */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Custom Prompt:</label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Add custom details if you want"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-vertical min-h-[60px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>

                  {/* Reference Face */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Reference Face (Optional):</label>
                    {referenceImage ? (
                      <div className="relative mx-auto" style={{ width: refSize.width, height: refSize.height }}>
                        <img src={referenceImage} alt="Reference" className="w-full h-full object-cover rounded-md border-2 border-dashed border-sky-300" />
                        <button
                          onClick={() => { setReferenceImage(null); if (refFileInputRef.current) refFileInputRef.current.value = ''; }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => refFileInputRef.current?.click()}
                        className="mx-auto border-2 border-dashed border-sky-300 rounded-md bg-gray-50 cursor-pointer flex flex-col items-center justify-center hover:border-sky-400 transition-colors"
                        style={{ width: refSize.width, height: refSize.height }}
                      >
                        <Upload className="h-5 w-5 text-sky-300 opacity-60 mb-1" />
                        <p className="text-[10px] text-gray-400">Upload reference</p>
                        <p className="text-[9px] text-gray-300">face</p>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1 text-center">Clear face photo for similar features</p>
                  </div>
                </div>
              )}
            </div>

            {/* Image Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image Type:</label>
              <select
                value={mockupType}
                onChange={(e) => setMockupType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="tshirt">T-shirt</option>
                <option value="hooded">Hooded</option>
                <option value="sweatshirt">Sweatshirt</option>
                <option value="baby-rib-bodysuit">Baby Rib Bodysuit</option>
                <option value="hat">Hat</option>
                <option value="mug">Mug</option>
              </select>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color:</label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="random">Random</option>
                <option value="black">#000000 (Black)</option>
                <option value="white">#ffffff (White)</option>
                <option value="sand">#d0c6b4 (Sand)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white space-y-2">
            <button
              onClick={handleGenerate}
              disabled={!uploadedImage || isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {isProcessing ? 'Generating...' : 'Generate Image'}
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
            {uploadedFileName && (
              <span className="text-xs text-gray-500">{uploadedFileName}</span>
            )}
          </div>

          {/* Preview Content */}
          <div className="flex-1 px-4 pb-2 overflow-hidden">
            <div className="h-full flex gap-4">
              {/* Original Image Panel - Aspect Ratio Frame */}
              <div ref={originalPanelRef} className="flex-1 flex items-center justify-center">
                {uploadedImage ? (
                  <div
                    ref={frameContainerRef}
                    className="relative overflow-hidden border-2 border-dashed border-sky-300 rounded-lg bg-gray-50 select-none"
                    style={{ width: frameSize.width, height: frameSize.height, cursor: isDragging ? 'grabbing' : 'move' }}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                  >
                    {/* Label */}
                    <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10 pointer-events-none">
                      Original
                    </div>
                    {/* Positioned image */}
                    <img
                      src={uploadedImage}
                      alt="Original"
                      className="absolute select-none pointer-events-none"
                      style={{
                        width: displayWidth,
                        height: displayHeight,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        left: imagePosition.x,
                        top: imagePosition.y,
                      }}
                      draggable={false}
                    />
                    {/* Frame Controls */}
                    <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); fitImageToFrame(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="px-2 py-1 bg-white/90 border border-gray-300 rounded text-[11px] font-medium text-gray-600 hover:bg-white transition-colors flex items-center gap-1"
                      >
                        <Maximize className="h-3 w-3" /> Fit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); fillImageToFrame(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="px-2 py-1 bg-white/90 border border-gray-300 rounded text-[11px] font-medium text-gray-600 hover:bg-white transition-colors flex items-center gap-1"
                      >
                        <Move className="h-3 w-3" /> Fill
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); resetImagePosition(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="px-2 py-1 bg-white/90 border border-gray-300 rounded text-[11px] font-medium text-gray-600 hover:bg-white transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed border-sky-300 rounded-lg bg-gray-50 cursor-pointer hover:border-sky-400 hover:bg-blue-50/30 transition-colors"
                    style={{ width: frameSize.width, height: frameSize.height }}
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
              <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-auto">
                <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10">
                  Result
                </div>
                {resultImage ? (
                  <img src={resultImage} alt="Result" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-300">
                    <Image className="h-12 w-12 opacity-40 mb-4" />
                    <p className="text-base opacity-60">No result yet</p>
                    <p className="text-sm opacity-50 mt-1">Upload and generate to see result</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 mx-4 mb-3 px-4 py-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusType === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : statusType === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <Info className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-600">{statusText}</span>
              </div>
              {resultImage && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              )}
            </div>
            {isProcessing && (
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 animate-pulse"
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
