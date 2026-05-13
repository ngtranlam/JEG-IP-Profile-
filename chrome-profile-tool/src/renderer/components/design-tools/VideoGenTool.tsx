import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Trash2, Video, Info, Loader2, FileVideo, FileText, Wand2, Save, Bookmark } from 'lucide-react';

type ViewMode = 'single' | 'dual' | 'motion';

export function VideoGenTool() {
  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [secondImage, setSecondImage] = useState<string | null>(null);
  const [secondFileName, setSecondFileName] = useState<string>('');
  const [motionVideo, setMotionVideo] = useState<string | null>(null);
  const [motionVideoName, setMotionVideoName] = useState<string>('');
  const [motionRefImage, setMotionRefImage] = useState<string | null>(null);

  // Result state
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [resultVideoBase64, setResultVideoBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Ready - Upload image to generate video');
  const [progress, setProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video Gen options
  const [aiModel, setAiModel] = useState('kling-v2-1-std');
  const [duration, setDuration] = useState<'5' | '10'>('10');
  const [dualImageMode, setDualImageMode] = useState(false);
  const [motionControlMode, setMotionControlMode] = useState(false);
  const [keepOriginalSound, setKeepOriginalSound] = useState(false);
  const [videoScript, setVideoScript] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const secondFileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const motionRefInputRef = useRef<HTMLInputElement>(null);

  // Cleanup poll/timeout on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, target: 'primary' | 'second' | 'video' | 'motionRef') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (target === 'video') {
      if (file.size > 100 * 1024 * 1024) {
        alert('Video file size must be less than 100MB');
        return;
      }
      const url = URL.createObjectURL(file);
      setMotionVideo(url);
      setMotionVideoName(file.name);
      setStatusText('Video loaded - Ready to generate');
      return;
    }

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
      if (target === 'primary') {
        setUploadedImage(dataUrl);
        setUploadedFileName(file.name);
        setStatusText('Image loaded - Ready to generate video');
      } else if (target === 'second') {
        setSecondImage(dataUrl);
        setSecondFileName(file.name);
      } else if (target === 'motionRef') {
        setMotionRefImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, target: 'primary' | 'second') => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (target === 'primary') {
        setUploadedImage(dataUrl);
        setUploadedFileName(file.name);
        setStatusText('Image loaded - Ready to generate video');
      } else {
        setSecondImage(dataUrl);
        setSecondFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // Derive effective view mode from toggles
  const effectiveViewMode: ViewMode = motionControlMode ? 'motion' : dualImageMode ? 'dual' : 'single';

  // Strip data URL prefix to get pure base64
  const stripDataUrl = (dataUrl: string): string => {
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
  };

  // Poll for video task status
  const pollVideoStatus = (taskId: string, isMotionControl: boolean) => {
    let elapsed = 0;
    const POLL_INTERVAL = 15000; // 15s
    const MAX_POLL = 600000; // 10min

    pollRef.current = setInterval(async () => {
      elapsed += POLL_INTERVAL;
      // Fake progress (max 90%)
      setProgress(Math.min(90, Math.round((elapsed / MAX_POLL) * 100)));

      try {
        const result = await (window as any).electronAPI.videoStatus(taskId, isMotionControl);

        if (!result || !result.success) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsProcessing(false);
          setStatusText(result?.error || 'Failed to check status');
          return;
        }

        if (result.status === 'succeed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setProgress(95);
          setStatusText('Video ready! Downloading...');

          if (result.videoUrl) {
            // Download video
            const dlResult = await (window as any).electronAPI.videoDownload(result.videoUrl);
            if (dlResult && dlResult.success && dlResult.videoBase64) {
              const blob = new Blob(
                [Uint8Array.from(atob(dlResult.videoBase64), c => c.charCodeAt(0))],
                { type: 'video/mp4' }
              );
              const blobUrl = URL.createObjectURL(blob);
              setResultVideoUrl(blobUrl);
              setResultVideoBase64(dlResult.videoBase64);
              setProgress(100);
              setStatusText('Video generated successfully!');

              // Track usage to report API (fire-and-forget)
              (window as any).electronAPI.reportTrackUsage('video', {
                ai_model: aiModel,
                duration: parseInt(duration),
              }).catch(() => {});
            } else {
              setStatusText('Video completed but download failed');
            }
          } else {
            setStatusText('Video completed but no URL returned');
          }
          setIsProcessing(false);
        } else if (result.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsProcessing(false);
          setStatusText(result.error || 'Video generation failed');
        } else {
          setStatusText('Generating video... Please wait');
        }
      } catch (err: any) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setIsProcessing(false);
        setStatusText('Error checking status: ' + err.message);
      }
    }, POLL_INTERVAL);

    // Timeout after 10 minutes
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setIsProcessing(false);
      setStatusText('Video generation timed out. Please try again.');
    }, MAX_POLL);
  };

  const handleGenerate = async () => {
    if (effectiveViewMode === 'motion') {
      // Motion Control flow
      if (!motionVideo || !motionRefImage) return;
      setIsProcessing(true);
      setProgress(5);
      setStatusText('Starting motion control video generation...');

      try {
        const refBase64 = stripDataUrl(motionRefImage);
        // For motion control, the video needs to be a URL.
        // Since we have a blob URL from file input, we upload the reference image
        // and pass the video as a data URL base64 to the API.
        // The motion control API expects a video_url, so we pass the video data URL.
        const motionMode = aiModel.includes('v2-6-pro') ? 'pro' : 'std';

        const result = await (window as any).electronAPI.motionStart({
          referenceImageBase64: refBase64,
          videoUrl: motionVideo,
          prompt: videoScript,
          mode: motionMode,
          keepOriginalSound: keepOriginalSound ? 'yes' : 'no',
        });

        if (result && result.success && result.taskId) {
          setProgress(10);
          setStatusText('Motion control task started. Polling for result...');
          pollVideoStatus(result.taskId, true);
        } else {
          setIsProcessing(false);
          setStatusText(result?.error || 'Failed to start motion control task');
        }
      } catch (err: any) {
        setIsProcessing(false);
        setStatusText('Error: ' + err.message);
      }
      return;
    }

    // Single / Dual image flow
    if (!uploadedImage) return;
    if (effectiveViewMode === 'dual' && !secondImage) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Starting video generation...');

    try {
      const imageBase64 = stripDataUrl(uploadedImage);
      const params: any = {
        imageBase64,
        prompt: videoScript || 'Generate a smooth cinematic video from this image. 9:16 vertical format, high quality, no text overlay.',
        aiModel,
        duration,
        dualMode: effectiveViewMode === 'dual',
      };

      if (effectiveViewMode === 'dual' && secondImage) {
        params.secondImageBase64 = stripDataUrl(secondImage);
      }

      const result = await (window as any).electronAPI.videoStart(params);

      if (result && result.success && result.taskId) {
        setProgress(10);
        setStatusText('Video task started. Polling for result...');
        pollVideoStatus(result.taskId, false);
      } else {
        setIsProcessing(false);
        setStatusText(result?.error || 'Failed to start video generation');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setStatusText('Error: ' + err.message);
    }
  };

  const handleClearAll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setUploadedImage(null);
    setUploadedFileName('');
    setSecondImage(null);
    setSecondFileName('');
    setMotionVideo(null);
    setMotionVideoName('');
    setMotionRefImage(null);
    setResultVideoUrl(null);
    setResultVideoBase64(null);
    setIsProcessing(false);
    setStatusText('Ready - Upload image to generate video');
    setProgress(0);
    setVideoScript('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (secondFileInputRef.current) secondFileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (motionRefInputRef.current) motionRefInputRef.current.value = '';
  };

  const handleDownloadVideo = async () => {
    if (!resultVideoBase64) return;
    try {
      await (window as any).electronAPI.designToolSaveVideo(
        resultVideoBase64,
        `kling_video_${Date.now()}.mp4`
      );
    } catch (err: any) {
      console.error('Save video error:', err);
    }
  };

  // Script template state
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<{ name: string; script: string }[]>([]);

  // Load templates from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('video_script_templates');
      if (saved) setTemplates(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const handleGenerateScript = async () => {
    if (!uploadedImage && !motionRefImage) {
      alert('Please upload an image first to generate a script.');
      return;
    }
    setIsGeneratingScript(true);
    setStatusText('Generating video script with AI...');
    try {
      const imageData = uploadedImage || motionRefImage;
      const base64 = imageData!.indexOf(',') >= 0 ? imageData!.substring(imageData!.indexOf(',') + 1) : imageData!;
      const result = await (window as any).electronAPI.videoGenerateScript(base64, duration, 'zoom');
      if (result && result.success && result.script) {
        setVideoScript(result.script);
        setScriptSaved(false);
        setStatusText('Script generated successfully!');

        // Track script_gen usage (fire-and-forget)
        (window as any).electronAPI.reportTrackUsage('script_gen', {}).catch(() => {});
      } else {
        setStatusText(result?.error || 'Failed to generate script');
      }
    } catch (err: any) {
      setStatusText('Error generating script: ' + err.message);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSaveScript = () => {
    if (!videoScript.trim()) return;
    setScriptSaved(true);
    setStatusText('Script saved! Ready to generate video.');
  };

  const handleSaveTemplate = () => {
    if (!videoScript.trim()) return;
    setShowSaveTemplateModal(true);
    setTemplateName('');
  };

  const confirmSaveTemplate = () => {
    if (!templateName.trim() || !videoScript.trim()) return;
    const updated = [...templates, { name: templateName.trim(), script: videoScript }];
    setTemplates(updated);
    localStorage.setItem('video_script_templates', JSON.stringify(updated));
    setShowSaveTemplateModal(false);
    setStatusText(`Template "${templateName.trim()}" saved!`);
  };

  const handleChooseTemplate = () => {
    try {
      const saved = localStorage.getItem('video_script_templates');
      if (saved) setTemplates(JSON.parse(saved));
    } catch { /* ignore */ }
    setShowTemplateModal(true);
  };

  const handleSelectTemplate = (script: string) => {
    setVideoScript(script);
    setScriptSaved(false);
    setShowTemplateModal(false);
    setStatusText('Template loaded. You can edit and save the script.');
  };

  const handleDeleteTemplate = (index: number) => {
    const updated = templates.filter((_, i) => i !== index);
    setTemplates(updated);
    localStorage.setItem('video_script_templates', JSON.stringify(updated));
  };

  const canGenerate = effectiveViewMode === 'single' ? !!uploadedImage
    : effectiveViewMode === 'dual' ? !!uploadedImage && !!secondImage
    : !!motionVideo;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800">Video Generation - AI Design Tool</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, 'primary')} />
            <input ref={secondFileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, 'second')} />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/mpeg,video/quicktime" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
            <input ref={motionRefInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, 'motionRef')} />

            {/* AI Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Model:</label>
              <select
                value={aiModel}
                onChange={(e) => {
                  const val = e.target.value;
                  if (dualImageMode && val !== 'kling-v2-1-pro') {
                    alert('Dual image mode only supports Kling V2.1 Pro.');
                    setAiModel('kling-v2-1-pro');
                    return;
                  }
                  if (motionControlMode && !val.includes('v2-6')) {
                    alert('Motion Control only supports Kling v2.6 models.');
                    return;
                  }
                  setAiModel(val);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="kling-v2-6-std">Kling v2.6 Std</option>
                <option value="kling-v2-6-pro">Kling v2.6 Pro</option>
                <option value="kling-v2-5-turbo">Kling v2.5 Turbo</option>
                <option value="kling-v2-1-std">Kling v2.1 Std</option>
                <option value="kling-v2-1-pro">Kling v2.1 Pro</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration:</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as '5' | '10')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
              </select>
            </div>

            {/* Use Two Images */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Use Two Images</label>
              <button
                onClick={() => {
                  const next = !dualImageMode;
                  setDualImageMode(next);
                  if (next) {
                    setMotionControlMode(false);
                    if (aiModel !== 'kling-v2-1-pro') {
                      alert('Dual image mode only supports Kling V2.1 Pro. Model will be auto-selected.');
                      setAiModel('kling-v2-1-pro');
                    }
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dualImageMode ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dualImageMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Motion Control */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Motion Control</label>
              <button
                onClick={() => {
                  const next = !motionControlMode;
                  setMotionControlMode(next);
                  if (next) {
                    setDualImageMode(false);
                    if (!aiModel.includes('v2-6')) {
                      alert('Motion Control requires a Kling v2.6 model. Model will be auto-selected to Kling v2.6 Std.');
                      setAiModel('kling-v2-6-std');
                    }
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  motionControlMode ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  motionControlMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Keep Original Sound (only when Motion Control is on) */}
            {motionControlMode && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Keep Original Sound</label>
                <button
                  onClick={() => setKeepOriginalSound(!keepOriginalSound)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    keepOriginalSound ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    keepOriginalSound ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            )}

            {/* Video Script */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video Script:</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={handleChooseTemplate}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  Choose Template
                </button>
                <button
                  onClick={handleGenerateScript}
                  disabled={isGeneratingScript || (!uploadedImage && !motionRefImage)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-300 text-blue-600 rounded text-xs hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGeneratingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  {isGeneratingScript ? 'Generating...' : 'Generate Script'}
                </button>
                <button
                  onClick={handleSaveScript}
                  disabled={!videoScript}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    scriptSaved ? 'bg-green-600 text-white' : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  <Save className="h-3 w-3" />
                  {scriptSaved ? 'Saved ✓' : 'Save Script'}
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!videoScript}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-amber-300 text-amber-600 rounded text-xs hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Bookmark className="h-3 w-3" />
                  Save Template
                </button>
                <button
                  onClick={() => setVideoScript('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-gray-500 rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <textarea
                value={videoScript}
                onChange={(e) => setVideoScript(e.target.value)}
                placeholder="Enter your video script here or use 'Generate Script' to create one automatically..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-vertical min-h-[300px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={16}
              />
              <p className="text-xs text-gray-400 mt-1.5">Describe the scene, camera movements, and visual effects you want in your video.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white space-y-2">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              {isProcessing ? 'Generating...' : 'Generate Video'}
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
            <h2 className="text-sm font-semibold text-gray-700">Image to Video Preview</h2>
            {uploadedFileName && (
              <span className="text-xs text-gray-500">{uploadedFileName}</span>
            )}
          </div>

          {/* Preview Content */}
          <div className="flex-1 px-4 pb-2 overflow-hidden">
            {/* Single Image Mode */}
            {effectiveViewMode === 'single' && (
              <div className="h-full flex gap-4">
                {/* Source Image */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10">
                    Source Image
                  </div>
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="Source" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-sky-300 rounded-lg bg-gray-50 cursor-pointer hover:border-sky-400 hover:bg-blue-50/30 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, 'primary')}
                    >
                      <Upload className="h-12 w-12 text-sky-300 opacity-60 mb-4" />
                      <h3 className="text-base text-gray-400 mb-2">Upload Image</h3>
                      <p className="text-sm text-gray-300 mb-1">Drag & drop or click to browse</p>
                      <p className="text-xs text-gray-300">Max size: 10MB</p>
                    </div>
                  )}
                </div>

                {/* Generated Video */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-2.5 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs z-10">
                    Generated Video
                  </div>
                  {resultVideoUrl ? (
                    <video controls className="max-w-full max-h-full object-contain">
                      <source src={resultVideoUrl} />
                    </video>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-300">
                      <FileVideo className="h-12 w-12 opacity-40 mb-4" />
                      <p className="text-base opacity-60">No video generated yet</p>
                      <p className="text-sm opacity-50 mt-1">Upload image and generate to see result</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dual Image Mode */}
            {effectiveViewMode === 'dual' && (
              <div className="h-full flex gap-3">
                {/* Image 1 */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-1.5 left-2.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[11px] z-10">
                    Image 1
                  </div>
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="Image 1" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-sky-300 rounded-lg bg-gray-50 cursor-pointer hover:border-sky-400 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, 'primary')}
                    >
                      <Upload className="h-8 w-8 text-sky-300 opacity-60 mb-2" />
                      <h3 className="text-sm text-gray-400 mb-1">Upload Image 1</h3>
                      <p className="text-[11px] text-gray-300">First image</p>
                    </div>
                  )}
                </div>

                {/* Image 2 */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-1.5 left-2.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[11px] z-10">
                    Image 2
                  </div>
                  {secondImage ? (
                    <img src={secondImage} alt="Image 2" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-orange-300 rounded-lg bg-gray-50 cursor-pointer hover:border-orange-400 transition-colors"
                      onClick={() => secondFileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, 'second')}
                    >
                      <Upload className="h-8 w-8 text-orange-300 opacity-60 mb-2" />
                      <h3 className="text-sm text-gray-400 mb-1">Upload Image 2</h3>
                      <p className="text-[11px] text-gray-300">Second image</p>
                    </div>
                  )}
                </div>

                {/* Generated Video */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-1.5 left-2.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[11px] z-10">
                    Generated Video
                  </div>
                  {resultVideoUrl ? (
                    <video controls className="max-w-full max-h-full object-contain">
                      <source src={resultVideoUrl} />
                    </video>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-300">
                      <FileVideo className="h-8 w-8 opacity-40 mb-2" />
                      <p className="text-sm opacity-60">No video yet</p>
                      <p className="text-[11px] opacity-50 mt-1">Upload both images</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Motion Control Mode */}
            {effectiveViewMode === 'motion' && (
              <div className="h-full flex gap-3">
                {/* Original Video */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-1.5 left-2.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[11px] z-10">
                    Original Video
                  </div>
                  {motionVideo ? (
                    <video controls className="max-w-full max-h-full object-contain">
                      <source src={motionVideo} />
                    </video>
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-sky-300 rounded-lg bg-gray-50 cursor-pointer hover:border-sky-400 transition-colors"
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <Video className="h-8 w-8 text-sky-300 opacity-60 mb-2" />
                      <h3 className="text-sm text-gray-400 mb-1">Upload Video</h3>
                      <p className="text-[11px] text-gray-300">Max 100MB, 9:16</p>
                    </div>
                  )}
                </div>

                {/* Reference Image */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-1.5 left-2.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[11px] z-10">
                    Reference Image
                  </div>
                  {motionRefImage ? (
                    <img src={motionRefImage} alt="Reference" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-orange-300 rounded-lg bg-gray-50 cursor-pointer hover:border-orange-400 transition-colors"
                      onClick={() => motionRefInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 text-orange-300 opacity-60 mb-2" />
                      <h3 className="text-sm text-gray-400 mb-1">Upload Reference Image</h3>
                      <p className="text-[11px] text-gray-300">Style reference</p>
                    </div>
                  )}
                </div>

                {/* Generated Video */}
                <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute top-1.5 left-2.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[11px] z-10">
                    Generated Video
                  </div>
                  {resultVideoUrl ? (
                    <video controls className="max-w-full max-h-full object-contain">
                      <source src={resultVideoUrl} />
                    </video>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-300">
                      <FileVideo className="h-8 w-8 opacity-40 mb-2" />
                      <p className="text-sm opacity-60">No video yet</p>
                      <p className="text-[11px] opacity-50 mt-1">Upload video and image</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 mx-4 mb-3 px-4 py-2.5 bg-white rounded-md border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{statusText}</span>
              </div>
              {resultVideoUrl && (
                <button
                  onClick={handleDownloadVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              )}
            </div>
            {isProcessing && (
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300 animate-pulse" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Choose Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Choose Template</h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No saved templates yet. Generate a script and save it as a template.</p>
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-gray-800">{tpl.name}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSelectTemplate(tpl.script)}
                            className="px-2.5 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          >
                            Use
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(idx)}
                            className="px-2.5 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{tpl.script}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Save Template</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name:</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmSaveTemplate()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveTemplate}
                  disabled={!templateName.trim()}
                  className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
