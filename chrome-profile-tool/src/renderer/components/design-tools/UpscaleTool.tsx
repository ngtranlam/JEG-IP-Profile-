import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Trash2, Image, Info, Loader2, ZoomIn, Search, CheckCircle, AlertCircle } from 'lucide-react';

interface UpscaleModel {
  id: string;
  name: string;
  description: string;
}

const UPSCALE_MODELS: UpscaleModel[] = [
  { id: 'upscayl-standard', name: 'Upscayl Standard', description: 'Standard AI model, works well for most images.' },
  { id: 'real-resolution', name: 'Real Resolution', description: 'Enhances details while giving a more natural, soft look.' },
  { id: 'quick-clear', name: 'Quick Clear', description: 'High speed upscaling with minimal quality loss.' },
  { id: 'digital-art', name: 'Digital Art', description: 'For digital art and illustrations.' },
  { id: 'crystal-plus', name: 'Crystal Plus', description: 'Removes artifacts and noise for cleaner images.' },
  { id: 'clear-boost', name: 'Clear Boost', description: 'For compressed images, enhances details and reduces artifacts.' },
  { id: 'upscayl-lite', name: 'Upscayl Lite', description: 'High speed with minimal quality loss.' },
  { id: 'natural-max', name: 'Natural Max', description: 'For compressed, low-resolution images and textures.' },
  { id: 'natural-plus', name: 'Natural Plus', description: 'Low-resolution images with a softer look.' },
  { id: 'nature-boost', name: 'Nature Boost', description: 'For nature images.' },
  { id: 'pure-boost', name: 'Pure Boost', description: 'For pure image enhancement.' },
  { id: 'texture-boost', name: 'Texture Boost', description: 'For texture-heavy images.' },
];

export function UpscaleTool() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Ready - Upload image to get started');
  const [progress, setProgress] = useState(0);

  // Upscale options
  const [selectedModel, setSelectedModel] = useState('upscayl-standard');
  const [outputScale, setOutputScale] = useState<'2' | '4' | '8'>('2');
  const [enhanceFace, setEnhanceFace] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Image info
  const [originalDimensions, setOriginalDimensions] = useState<string>('');
  const [originalFileSize, setOriginalFileSize] = useState<string>('');
  const [resultDimensions, setResultDimensions] = useState<string>('');
  const [resultFileSize, setResultFileSize] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
    setOriginalFileSize(formatFileSize(file.size));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        setOriginalDimensions(`${img.width} x ${img.height}`);
      };
      img.src = ev.target?.result as string;
      setUploadedImage(ev.target?.result as string);
      setUploadedFileName(file.name);
      setStatusText('Image loaded - Ready to upscale');
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
    setOriginalFileSize(formatFileSize(file.size));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        setOriginalDimensions(`${img.width} x ${img.height}`);
      };
      img.src = ev.target?.result as string;
      setUploadedImage(ev.target?.result as string);
      setUploadedFileName(file.name);
      setStatusText('Image loaded - Ready to upscale');
    };
    reader.readAsDataURL(file);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const handleUpscale = async () => {
    if (!uploadedImage) return;
    setIsProcessing(true);
    setProgress(0);
    setErrorText('');
    setResultImage(null);
    setResultDimensions('');
    setResultFileSize('');
    setStatusText('Uploading image...');

    try {
      // Extract base64 from data URL
      const base64 = uploadedImage.split(',')[1];
      if (!base64) throw new Error('Invalid image data');

      setProgress(10);
      setStatusText(`Initializing ${selectedModelInfo?.name || 'AI'} model...`);

      // Step 1: Start upscale task
      const startResult = await (window as any).electronAPI.upscaleStart({
        imageBase64: base64,
        scale: parseInt(outputScale),
        model: selectedModel,
        enhanceFace,
      });

      if (!startResult.success || !startResult.taskId) {
        throw new Error(startResult.error || 'Failed to start upscale task');
      }

      const taskId = startResult.taskId;
      setProgress(20);
      setStatusText(`Upscaling image to ${outputScale}x...`);

      // Step 2: Poll for status
      await new Promise<void>((resolve, reject) => {
        let progressVal = 20;

        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusResult = await (window as any).electronAPI.upscaleStatus(taskId);

            if (!statusResult.success) {
              // Keep polling on transient failures
              return;
            }

            const status = statusResult.status;

            // Simulate progress
            if (progressVal < 85) {
              progressVal += 5;
              setProgress(progressVal);
            }

            if (status === 'PROCESSING' || status === 'UPSCALING' || status === 'ENHANCING') {
              setStatusText(status === 'ENHANCING' ? 'Enhancing facial features...' : `Upscaling image to ${outputScale}x...`);
            }

            if (status === 'PROCESSED' || status === 'COMPLETED' || status === 'SUCCESS' || status === 'DONE') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

              const downloadLink = statusResult.downloadLink;
              if (!downloadLink) {
                reject(new Error('No download link in completed result'));
                return;
              }

              setProgress(90);
              setStatusText('Downloading upscaled image...');

              // Step 3: Download result
              const downloadResult = await (window as any).electronAPI.upscaleDownload(downloadLink);
              if (!downloadResult.success || !downloadResult.imageBase64) {
                reject(new Error(downloadResult.error || 'Failed to download result'));
                return;
              }

              // Show result
              const resultDataUrl = `data:image/png;base64,${downloadResult.imageBase64}`;
              setResultImage(resultDataUrl);
              setResultFileSize(formatFileSize(downloadResult.size || 0));

              // Get result dimensions
              const resultImg = new window.Image();
              resultImg.onload = () => {
                setResultDimensions(`${resultImg.width} x ${resultImg.height}`);
              };
              resultImg.src = resultDataUrl;

              setProgress(100);
              setStatusText('Upscaling completed successfully!');

              // Track usage to report API (fire-and-forget)
              (window as any).electronAPI.reportTrackUsage('upscale', {
                model: selectedModel,
                scale: parseInt(outputScale),
              }).catch(() => {});

              resolve();
            }

            if (status === 'FAILED' || status === 'ERROR') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
              reject(new Error(statusResult.error || 'Upscaling failed'));
            }
          } catch (err: any) {
            // Transient poll error, keep trying
            console.error('[Upscale] Poll error:', err.message);
          }
        }, 5000);

        // Timeout after 10 minutes
        pollTimeoutRef.current = setTimeout(() => {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          reject(new Error('Upscaling timeout. Please try again.'));
        }, 600000);
      });

    } catch (err: any) {
      console.error('[Upscale] Error:', err.message);
      setErrorText(err.message);
      setStatusText('Failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!resultImage) return;
    try {
      const base64 = resultImage.split(',')[1];
      await (window as any).electronAPI.designToolSaveResult(base64, `upscale_${outputScale}x_${Date.now()}.png`);
    } catch (err: any) {
      console.error('[Upscale] Download failed:', err.message);
    }
  };

  const handleClearAll = () => {
    setUploadedImage(null);
    setUploadedFileName('');
    setResultImage(null);
    setIsProcessing(false);
    setStatusText('Ready - Upload image to get started');
    setProgress(0);
    setOriginalDimensions('');
    setOriginalFileSize('');
    setResultDimensions('');
    setResultFileSize('');
    setErrorText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
  };

  const selectedModelInfo = UPSCALE_MODELS.find(m => m.id === selectedModel);
  const filteredModels = UPSCALE_MODELS.filter(m =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.description.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800">Upscale - AI Design Tool</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={handleFileUpload} />

            {/* AI Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Model:</label>
              <button
                onClick={() => setShowModelModal(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <span className="truncate">{selectedModelInfo?.name || 'Select Model'}</span>
                <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              </button>
              {selectedModelInfo && (
                <p className="text-[11px] text-gray-400 mt-1">{selectedModelInfo.description}</p>
              )}
            </div>

            {/* Output Scale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Output Scale:</label>
              <div className="flex gap-2">
                {(['2', '4', '8'] as const).map((scale) => (
                  <button
                    key={scale}
                    onClick={() => setOutputScale(scale)}
                    className={`flex-1 px-3 py-2 border-2 rounded-md text-sm font-medium transition-all ${
                      outputScale === scale
                        ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>

            {/* Face Enhancement */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Face Enhancement</label>
              <button
                onClick={() => setEnhanceFace(!enhanceFace)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enhanceFace ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enhanceFace ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Original Image Info */}
            {uploadedImage && (
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_0_2px_rgba(59,130,246,0.2)]" />
                  <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Original Image</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white px-2 py-1.5 rounded border border-blue-200 text-center">
                    <div className="text-[10px] text-blue-700 mb-0.5">Dimensions</div>
                    <div className="text-xs font-bold text-blue-600">{originalDimensions || '-'}</div>
                  </div>
                  <div className="bg-white px-2 py-1.5 rounded border border-blue-200 text-center">
                    <div className="text-[10px] text-blue-700 mb-0.5">File Size</div>
                    <div className="text-xs font-bold text-gray-600">{originalFileSize || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Result Info */}
            {resultImage && (
              <div className="bg-green-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_0_2px_rgba(34,197,94,0.2)]" />
                  <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">Enhanced Result</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-white px-1.5 py-1.5 rounded border border-green-200 text-center">
                    <div className="text-[10px] text-green-700 mb-0.5">Scale Factor</div>
                    <div className="text-xs font-bold text-blue-600">{outputScale}x</div>
                  </div>
                  <div className="bg-white px-1.5 py-1.5 rounded border border-green-200 text-center">
                    <div className="text-[10px] text-green-700 mb-0.5">New Size</div>
                    <div className="text-xs font-bold text-green-600">{resultDimensions || '-'}</div>
                  </div>
                  <div className="bg-white px-1.5 py-1.5 rounded border border-green-200 text-center">
                    <div className="text-[10px] text-green-700 mb-0.5">File Size</div>
                    <div className="text-xs font-bold text-gray-600">{resultFileSize || '-'}</div>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-400 text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                    AI Enhanced
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white space-y-2">
            <button
              onClick={handleUpscale}
              disabled={!uploadedImage || isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ZoomIn className="h-4 w-4" />}
              {isProcessing ? 'Upscaling...' : 'Upscale Image'}
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
              {/* Original Image Panel */}
              <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10">
                  Original
                </div>
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Original" className="max-w-full max-h-full object-contain" />
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
                {resultImage ? (
                  <img src={resultImage} alt="Result" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-300">
                    <Image className="h-12 w-12 opacity-40 mb-4" />
                    <p className="text-base opacity-60">No result yet</p>
                    <p className="text-sm opacity-50 mt-1">Upload and upscale to see result</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 mx-4 mb-3 px-4 py-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-gray-400" />
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
            {(isProcessing || progress > 0) && (
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Model Selection Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModelModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex-shrink-0 px-6 py-5 bg-gradient-to-r from-orange-500 to-orange-400 rounded-t-xl">
              <h3 className="text-lg font-semibold text-white text-center uppercase tracking-wider">Select AI Model</h3>
            </div>

            {/* Search Box */}
            <div className="flex-shrink-0 px-6 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search models"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setShowModelModal(false);
                    setModelSearch('');
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    selectedModel === model.id
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <h4 className="text-sm font-semibold text-gray-800">{model.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{model.description}</p>
                </button>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => { setShowModelModal(false); setModelSearch(''); }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
