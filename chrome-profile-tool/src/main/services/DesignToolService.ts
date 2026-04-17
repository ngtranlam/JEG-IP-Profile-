import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import sharp from 'sharp';
import { ApiService } from './ApiService';

// NO API KEYS HERE - all external API calls go through the server

interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OutputSize {
  width: number;
  height: number;
}

interface ExtractOptions {
  imageBuffer: Buffer;
  outputSize: string;
  designType: 'print' | 'embroidery';
  removeBackground: boolean;
  upscaleEnabled: boolean;
  upscaleScale: number;
  redesignEnabled: boolean;
  redesignPrompt: string;
  cropCoordinates: CropCoordinates;
  authToken: string;
}

interface ExtractResult {
  success: boolean;
  imageBase64?: string;
  downloadBase64?: string;
  processingTime?: number;
  error?: string;
  step?: string;
}

function getTempDir(): string {
  const tempDir = path.join(app.getPath('temp'), 'design-tool');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

function parseOutputSize(sizeString: string): OutputSize {
  const parts = sizeString.split('x');
  return {
    width: parseInt(parts[0]),
    height: parseInt(parts[1])
  };
}

/**
 * Crop image using sharp (local processing, no API needed)
 */
async function cropImage(imageBuffer: Buffer, crop: CropCoordinates): Promise<Buffer> {
  console.log('[DesignTool] Cropping image:', crop);
  
  const metadata = await sharp(imageBuffer).metadata();
  const sourceWidth = metadata.width || 0;
  const sourceHeight = metadata.height || 0;
  
  const cropX = Math.max(0, Math.min(Math.round(crop.x), sourceWidth));
  const cropY = Math.max(0, Math.min(Math.round(crop.y), sourceHeight));
  const cropWidth = Math.min(Math.round(crop.width), sourceWidth - cropX);
  const cropHeight = Math.min(Math.round(crop.height), sourceHeight - cropY);
  
  if (cropWidth <= 0 || cropHeight <= 0) {
    throw new Error('Invalid crop coordinates');
  }
  
  const cropped = await sharp(imageBuffer)
    .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();
  
  console.log(`[DesignTool] Cropped: ${sourceWidth}x${sourceHeight} -> ${cropWidth}x${cropHeight}`);
  return cropped;
}

/**
 * Call Gemini API via server proxy
 */
async function callGeminiApi(apiService: ApiService, token: string, imageBuffer: Buffer, designType: string, customPrompt?: string): Promise<Buffer> {
  console.log('[DesignTool] Calling Gemini API via server, type:', designType);
  
  const imageBase64 = imageBuffer.toString('base64');
  const result = await apiService.designToolCallGemini(token, imageBase64, designType, customPrompt || undefined);
  
  if (result.success && result.imageBase64) {
    console.log('[DesignTool] Got image from Gemini API via server');
    return Buffer.from(result.imageBase64, 'base64');
  }
  
  throw new Error(result.error || 'Gemini API did not return image data');
}

/**
 * Call PhotoRoom API via server proxy for background removal
 */
async function callPhotoroomApi(apiService: ApiService, token: string, imageBuffer: Buffer): Promise<Buffer | null> {
  console.log('[DesignTool] Calling PhotoRoom API via server');
  
  try {
    const imageBase64 = imageBuffer.toString('base64');
    const result = await apiService.designToolCallPhotoroom(token, imageBase64);
    
    if (result.success && result.imageBase64) {
      console.log('[DesignTool] PhotoRoom API success via server');
      return Buffer.from(result.imageBase64, 'base64');
    }
    
    return null;
  } catch (error: any) {
    console.warn('[DesignTool] PhotoRoom API failed:', error.message);
    return null;
  }
}

/**
 * Call Upscayl API via server proxy (start → poll → download)
 */
async function callUpscaylApi(apiService: ApiService, token: string, imageBuffer: Buffer, scaleFactor: number, model: string = 'upscayl-standard-4x'): Promise<Buffer> {
  console.log(`[DesignTool] Starting Upscayl via server, scale: ${scaleFactor}x`);
  
  const imageBase64 = imageBuffer.toString('base64');
  
  // Step 1: Start task via server
  const startResult = await apiService.designToolUpscaleStart(token, imageBase64, scaleFactor, model);
  if (!startResult.success || !startResult.taskId) {
    throw new Error(startResult.error || 'Upscayl start task failed');
  }
  
  const taskId = startResult.taskId;
  console.log('[DesignTool] Upscayl task started:', taskId);
  
  // Step 2: Poll for completion via server
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResult = await apiService.designToolUpscaleStatus(token, taskId);
    const status = statusResult.status;
    
    console.log(`[DesignTool] Upscayl status: ${status}, attempt: ${attempt + 1}`);
    
    if (status === 'PROCESSED' || status === 'COMPLETED') {
      const downloadLink = statusResult.downloadLink;
      if (!downloadLink) {
        throw new Error('Upscayl completed but no download link');
      }
      
      // Step 3: Download via server
      const downloadResult = await apiService.designToolUpscaleDownload(token, downloadLink);
      if (downloadResult.success && downloadResult.imageBase64) {
        console.log('[DesignTool] Upscayl download complete via server, size:', downloadResult.size);
        return Buffer.from(downloadResult.imageBase64, 'base64');
      }
      throw new Error('Upscayl download failed');
    }
    
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`Upscayl task failed: ${statusResult.error || 'Unknown'}`);
    }
  }
  
  throw new Error('Upscayl task timeout');
}

/**
 * Scale image to fit within target size (local processing)
 */
async function scaleImageToFit(imageBuffer: Buffer, targetSize: OutputSize): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const sourceWidth = metadata.width || 1;
  const sourceHeight = metadata.height || 1;
  
  const scaleX = targetSize.width / sourceWidth;
  const scaleY = targetSize.height / sourceHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const newWidth = Math.round(sourceWidth * scale);
  const newHeight = Math.round(sourceHeight * scale);
  
  console.log(`[DesignTool] Scaling: ${sourceWidth}x${sourceHeight} -> ${newWidth}x${newHeight}`);
  
  return sharp(imageBuffer)
    .resize(newWidth, newHeight, { fit: 'inside' })
    .png()
    .toBuffer();
}

/**
 * Place image centered on a transparent canvas (local processing)
 */
async function placeOnCanvas(imageBuffer: Buffer, outputSize: OutputSize): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;
  
  let finalBuffer = imageBuffer;
  let finalWidth = imgWidth;
  let finalHeight = imgHeight;
  
  if (imgWidth > outputSize.width || imgHeight > outputSize.height) {
    finalBuffer = await scaleImageToFit(imageBuffer, outputSize);
    const finalMeta = await sharp(finalBuffer).metadata();
    finalWidth = finalMeta.width || 0;
    finalHeight = finalMeta.height || 0;
  }
  
  const left = Math.max(0, Math.round((outputSize.width - finalWidth) / 2));
  const top = Math.max(0, Math.round((outputSize.height - finalHeight) / 2));
  
  console.log(`[DesignTool] Canvas: ${outputSize.width}x${outputSize.height}, placing at: ${left},${top}`);
  
  return sharp({
    create: {
      width: outputSize.width,
      height: outputSize.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: finalBuffer, left, top }])
    .png()
    .toBuffer();
}

/**
 * Main extract design pipeline
 * All external API calls (Gemini, PhotoRoom, Upscayl) go through the server.
 * Local processing (crop, scale, canvas) stays in the Electron app.
 */
export async function extractDesign(apiService: ApiService, options: ExtractOptions, progressCallback?: (step: string, progress: number) => void): Promise<ExtractResult> {
  const startTime = Date.now();
  
  try {
    const outputSize = parseOutputSize(options.outputSize);
    const token = options.authToken;
    
    // Step 1: Crop (local)
    progressCallback?.('Cropping selected area...', 10);
    const croppedBuffer = await cropImage(options.imageBuffer, options.cropCoordinates);
    
    // Step 2: Gemini AI (via server)
    let processedBuffer: Buffer;
    if (options.redesignEnabled && options.redesignPrompt) {
      progressCallback?.('Redesigning with AI...', 25);
      processedBuffer = await callGeminiApi(apiService, token, croppedBuffer, 'custom', options.redesignPrompt);
    } else {
      progressCallback?.(`Extracting ${options.designType} design with AI...`, 25);
      processedBuffer = await callGeminiApi(apiService, token, croppedBuffer, options.designType);
    }
    
    // Step 3: Background removal (via server)
    if (options.removeBackground) {
      progressCallback?.('Removing background...', 50);
      const bgRemoved = await callPhotoroomApi(apiService, token, processedBuffer);
      if (bgRemoved) {
        processedBuffer = bgRemoved;
      } else {
        console.warn('[DesignTool] PhotoRoom failed, using Gemini result as fallback');
      }
    }
    
    // Step 4: Upscale (via server)
    let downloadBuffer = processedBuffer;
    if (options.upscaleEnabled) {
      progressCallback?.(`AI Upscaling (${options.upscaleScale}x)...`, 65);
      const upscaledBuffer = await callUpscaylApi(apiService, token, processedBuffer, options.upscaleScale, 'upscayl-standard-4x');
      downloadBuffer = upscaledBuffer;
      processedBuffer = upscaledBuffer;
    }
    
    // Step 5: Scale to fit canvas (local)
    progressCallback?.('Scaling to fit canvas...', 85);
    const scaledBuffer = await scaleImageToFit(processedBuffer, outputSize);
    
    // Step 6: Place on canvas (local)
    progressCallback?.('Finalizing result...', 95);
    const canvasBuffer = await placeOnCanvas(scaledBuffer, outputSize);
    
    const processingTime = Date.now() - startTime;
    console.log(`[DesignTool] Processing completed in ${processingTime}ms`);
    
    progressCallback?.('Processing completed!', 100);
    
    return {
      success: true,
      imageBase64: canvasBuffer.toString('base64'),
      downloadBase64: downloadBuffer.toString('base64'),
      processingTime
    };
    
  } catch (error: any) {
    console.error('[DesignTool] Extract failed:', error.message);
    return {
      success: false,
      error: error.message,
      step: 'extract'
    };
  }
}

/**
 * Cleanup old temp files (called periodically)
 */
export function cleanupTempFiles(): void {
  try {
    const tempDir = getTempDir();
    if (!fs.existsSync(tempDir)) return;
    
    const files = fs.readdirSync(tempDir);
    const oneHourAgo = Date.now() - 3600000;
    let cleaned = 0;
    
    for (const file of files) {
      const filepath = path.join(tempDir, file);
      const stat = fs.statSync(filepath);
      if (stat.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filepath);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[DesignTool] Cleaned ${cleaned} temp files`);
    }
  } catch (e) {
    console.warn('[DesignTool] Temp cleanup failed');
  }
}
