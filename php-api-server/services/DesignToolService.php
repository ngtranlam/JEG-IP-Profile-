<?php

class DesignToolService {
    private $photoroomApiKey;
    private $upscaylApiKey;
    private $klingAccessKey;
    private $klingSecretKey;
    private $klingApiDomain = 'https://api-singapore.klingai.com';

    // Vertex AI config for Clone feature
    private $vertexProjectId = 'jegtech';
    private $vertexLocation = 'us-central1';
    private $vertexModel = 'gemini-2.5-flash-image';
    private $serviceAccountPath;
    private $vertexAccessToken = null;
    private $vertexTokenExpiry = 0;

    // Vertex AI config for Script Generation
    private $scriptVertexLocation = 'global';
    private $scriptVertexModel = 'gemini-3.1-pro-preview';

    // Model to location mapping
    private $modelLocationMap = [
        'gemini-2.5-flash-image' => 'us-central1',
        'gemini-3-pro-image-preview' => 'global',
    ];

    public function __construct() {
        $this->photoroomApiKey = $_ENV['PHOTOROOM_API_KEY'] ?? '';
        $this->upscaylApiKey = $_ENV['UPSCAYL_API_KEY'] ?? '';
        $this->klingAccessKey = $_ENV['KLING_ACCESS_KEY'] ?? '';
        $this->klingSecretKey = $_ENV['KLING_SECRET_KEY'] ?? '';
        $saPath = $_ENV['SERVICE_ACCOUNT_PATH'] ?? 'jegtech-648aa015165c.json';
        // Resolve relative path from php-api-server root
        if ($saPath[0] !== '/') {
            $saPath = realpath(__DIR__ . '/../' . $saPath) ?: __DIR__ . '/../' . $saPath;
        }
        $this->serviceAccountPath = $saPath;
    }

    /**
     * Set Vertex AI model and auto-map location
     */
    public function setVertexModel($model) {
        $this->vertexModel = $model;
        if (isset($this->modelLocationMap[$model])) {
            $this->vertexLocation = $this->modelLocationMap[$model];
        }
    }

    /**
     * Get Vertex AI access token from Service Account using JWT
     */
    private function getVertexAccessToken() {
        // Return cached token if still valid (with 60s buffer)
        if ($this->vertexAccessToken && time() < ($this->vertexTokenExpiry - 60)) {
            return $this->vertexAccessToken;
        }

        $saJson = json_decode(file_get_contents($this->serviceAccountPath), true);
        if (!$saJson || !isset($saJson['private_key']) || !isset($saJson['client_email'])) {
            throw new Exception('Invalid service account JSON file: ' . $this->serviceAccountPath);
        }

        $now = time();
        $header = rtrim(strtr(base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])), '+/', '-_'), '=');

        $claimSet = [
            'iss' => $saJson['client_email'],
            'scope' => 'https://www.googleapis.com/auth/cloud-platform',
            'aud' => $saJson['token_uri'] ?? 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ];
        $payload = rtrim(strtr(base64_encode(json_encode($claimSet)), '+/', '-_'), '=');

        $signatureInput = $header . '.' . $payload;
        $privateKey = openssl_pkey_get_private($saJson['private_key']);
        if (!$privateKey) {
            throw new Exception('Failed to parse service account private key');
        }
        openssl_sign($signatureInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        $signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

        $jwt = $signatureInput . '.' . $signature;

        // Exchange JWT for access token
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $saJson['token_uri'] ?? 'https://oauth2.googleapis.com/token',
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POSTFIELDS => http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Vertex AI token request cURL error: ' . $error);
        }
        if ($httpCode !== 200) {
            throw new Exception('Vertex AI token request failed: HTTP ' . $httpCode . ' - ' . $response);
        }

        $tokenData = json_decode($response, true);
        if (!isset($tokenData['access_token'])) {
            throw new Exception('No access_token in Vertex AI token response');
        }

        $this->vertexAccessToken = $tokenData['access_token'];
        $this->vertexTokenExpiry = $now + ($tokenData['expires_in'] ?? 3600);

        return $this->vertexAccessToken;
    }

    /**
     * Get current configuration (model names, available options)
     */
    public function getConfig() {
        return [
            'gemini_model' => $this->geminiModel,
            'output_sizes' => [
                '4500x4500' => '4500 x 4500 px',
                '4500x5400' => '4500 x 5400 px',
                '1500x1500' => '1500 x 1500 px',
                '3000x3000' => '3000 x 3000 px',
                '3300x5100' => '3300 x 5100 px',
            ],
            'design_types' => ['print', 'embroidery'],
            'upscale_models' => ['upscayl-standard-4x'],
            'upscale_scales' => [2, 4, 8],
            'has_gemini' => !empty($this->serviceAccountPath),
            'has_photoroom' => !empty($this->photoroomApiKey),
            'has_upscayl' => !empty($this->upscaylApiKey),
        ];
    }

    /**
     * Proxy call to Gemini API for design extraction/redesign (via Vertex AI)
     */
    public function callGeminiApi($imageBase64, $designType, $customPrompt = null) {
        // Build prompt
        if ($customPrompt) {
            $prompt = $customPrompt;
        } elseif ($designType === 'embroidery') {
            $prompt = "Như một Designer chuyên nghiệp, hãy thực hiện vẽ lại thiết kế này theo phong cách thêu thực tế trên nền xanh lá tươi có độ tương phản cao phù hợp cho việc tách nền. Thiết kế được khâu bằng chỉ, các đường chỉ thêu ngang và căng bóng, với kết cấu rõ ràng và thể hiện tốt độ sâu 3D. Chỉ thực hiện thêu phần thiết kế, phần nền là màu xanh Chromakey hoàn toàn.";
        } else {
            $prompt = "Như một designer chuyên nghiệp, hãy vẽ lại thiết kế này trên nền xanh lá tươi có độ tương phản cao phù hợp cho việc tách nền. Với các chi tiết của hình ảnh được vẽ lại hoàn toàn, giữ nguyên màu sắc, văn bản, hình ảnh và chi tiết như trong hình gốc. Điều chỉnh căn giữa và thẳng, đặt thiết kế lớn lên vừa bằng khung ảnh.";
        }

        $payload = [
            'contents' => [[
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => 'image/png',
                            'data' => $imageBase64,
                        ]
                    ]
                ]
            ]],
            'generationConfig' => [
                'responseModalities' => ['TEXT', 'IMAGE'],
                'temperature' => 0.1,
                'topP' => 0.7,
                'maxOutputTokens' => 8192,
                'imageConfig' => [
                    'personGeneration' => 'allow_all'
                ]
            ],
            'safetySettings' => [
                ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_NONE'],
                ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_NONE'],
                ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_NONE'],
                ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_NONE'],
            ]
        ];

        // Use Vertex AI endpoint with Service Account auth
        $accessToken = $this->getVertexAccessToken();
        $apiHost = $this->vertexLocation === 'global'
            ? 'aiplatform.googleapis.com'
            : "{$this->vertexLocation}-aiplatform.googleapis.com";
        $url = "https://{$apiHost}/v1beta1/projects/{$this->vertexProjectId}/locations/{$this->vertexLocation}/publishers/google/models/{$this->vertexModel}:generateContent";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 300,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Vertex AI cURL error: ' . $error);
        }

        if ($httpCode >= 400) {
            $decoded = json_decode($response, true);
            $errorMsg = $decoded['error']['message'] ?? "HTTP $httpCode";
            throw new Exception('Vertex AI error: ' . $errorMsg);
        }

        $data = json_decode($response, true);

        // Extract image from response
        if (isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $part) {
                $inlineData = $part['inline_data'] ?? $part['inlineData'] ?? null;
                if ($inlineData && isset($inlineData['data'])) {
                    return [
                        'success' => true,
                        'imageBase64' => $inlineData['data'],
                    ];
                }
            }
        }

        throw new Exception('Vertex AI did not return image data');
    }

    /**
     * Proxy call to Gemini API with a reference image (for face similarity in mockups) via Vertex AI
     */
    public function callGeminiApiWithReference($imageBase64, $referenceBase64, $designType, $customPrompt = null) {
        $prompt = $customPrompt ?: "Như một designer chuyên nghiệp, hãy vẽ lại thiết kế này trên nền xanh lá tươi có độ tương phản cao phù hợp cho việc tách nền. Giữ nguyên màu sắc, văn bản, hình ảnh và chi tiết như trong hình gốc. Tham khảo hình ảnh thứ hai để đảm bảo tính nhất quán về phong cách.";

        $payload = [
            'contents' => [[
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => 'image/png',
                            'data' => $imageBase64,
                        ]
                    ],
                    [
                        'inline_data' => [
                            'mime_type' => 'image/png',
                            'data' => $referenceBase64,
                        ]
                    ]
                ]
            ]],
            'generationConfig' => [
                'responseModalities' => ['TEXT', 'IMAGE'],
                'temperature' => 0.1,
                'topP' => 0.7,
                'maxOutputTokens' => 8192,
                'imageConfig' => [
                    'personGeneration' => 'allow_all'
                ]
            ],
            'safetySettings' => [
                ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_NONE'],
                ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_NONE'],
                ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_NONE'],
                ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_NONE'],
            ]
        ];

        // Use Vertex AI endpoint with Service Account auth
        $accessToken = $this->getVertexAccessToken();
        $apiHost = $this->vertexLocation === 'global'
            ? 'aiplatform.googleapis.com'
            : "{$this->vertexLocation}-aiplatform.googleapis.com";
        $url = "https://{$apiHost}/v1beta1/projects/{$this->vertexProjectId}/locations/{$this->vertexLocation}/publishers/google/models/{$this->vertexModel}:generateContent";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 300,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) throw new Exception('Vertex AI cURL error: ' . $error);
        if ($httpCode >= 400) {
            $decoded = json_decode($response, true);
            $errorMsg = $decoded['error']['message'] ?? "HTTP $httpCode";
            throw new Exception('Vertex AI error: ' . $errorMsg);
        }

        $data = json_decode($response, true);
        if (isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $part) {
                $inlineData = $part['inline_data'] ?? $part['inlineData'] ?? null;
                if ($inlineData && isset($inlineData['data'])) {
                    return ['success' => true, 'imageBase64' => $inlineData['data']];
                }
            }
        }

        throw new Exception('Vertex AI with reference did not return image data');
    }

    /**
     * Generate mockup image: build prompt, call Gemini, return result
     */
    public function generateMockup($params) {
        $imageBase64 = $params['imageBase64'];
        $platform = $params['platform'] ?? 'etsy';
        $processingType = $params['processingType'] ?? 'print';
        $mockupSide = $params['mockupSide'] ?? 'front';
        $modelEnabled = !empty($params['modelEnabled']);
        $gender = $params['gender'] ?? 'male';
        $pose = $params['pose'] ?? 'standing';
        $ageMin = $params['ageMin'] ?? 20;
        $ageMax = $params['ageMax'] ?? 35;
        $customPrompt = $params['customPrompt'] ?? '';
        $mockupType = $params['mockupType'] ?? 'tshirt';
        $color = $params['color'] ?? 'random';
        $referenceBase64 = $params['referenceImageBase64'] ?? null;
        $aspectRatio = $params['aspectRatio'] ?? '1:1';

        // Build prompt
        $prompt = $this->getMockupPrompt($platform, $processingType, $mockupSide, $modelEnabled, $gender, $pose, $ageMin, $ageMax, $customPrompt, $mockupType, $color, !empty($referenceBase64));

        // Adjust prompt size based on aspect ratio
        if ($aspectRatio === '9:16') {
            $prompt = str_replace('1024x1024', '576x1024', $prompt);
        }

        // Call Gemini with or without reference
        if (!empty($referenceBase64) && $modelEnabled) {
            $result = $this->callGeminiApiWithReference($imageBase64, $referenceBase64, 'mockup', $prompt);
        } else {
            $result = $this->callGeminiApi($imageBase64, 'mockup', $prompt);
        }

        return $result;
    }

    /**
     * Build the mockup prompt from parameters
     */
    private function getMockupPrompt($platform, $processingType, $mockupSide, $modelEnabled, $gender, $pose, $ageMin, $ageMax, $customPrompt, $mockupType, $color = 'random', $hasReference = false) {
        $promptKey = ucfirst(str_replace('-', ' ', $mockupType));
        if ($promptKey === 'Tshirt') $promptKey = 'T-shirt';
        if ($promptKey === 'Baby rib bodysuit') $promptKey = 'Baby Rib Bodysuit';

        $prompts = $this->getAllMockupPrompts();

        // Select prompt key based on parameters
        if ($platform === 'etsy') {
            if ($processingType === 'embroidery') {
                if ($modelEnabled) {
                    $promptArray = ($mockupSide === 'front')
                        ? ($gender === 'male' ? $prompts['embroidery_model_front_male'] : $prompts['embroidery_model_front_female'])
                        : ($gender === 'male' ? $prompts['embroidery_model_back_male'] : $prompts['embroidery_model_back_female']);
                } else {
                    $promptArray = $mockupSide === 'front' ? $prompts['embroidery_front'] : $prompts['embroidery_back'];
                }
            } else {
                if ($modelEnabled) {
                    $promptArray = ($mockupSide === 'front')
                        ? ($gender === 'male' ? $prompts['print_model_front_male'] : $prompts['print_model_front_female'])
                        : ($gender === 'male' ? $prompts['print_model_back_male'] : $prompts['print_model_back_female']);
                } else {
                    $promptArray = $mockupSide === 'front' ? $prompts['print_front'] : $prompts['print_back'];
                }
            }
        } else {
            // TikTok
            if ($processingType === 'embroidery') {
                if ($modelEnabled) {
                    $promptArray = ($mockupSide === 'front')
                        ? ($gender === 'male' ? $prompts['embroidery_model_front_male_tiktok'] : $prompts['embroidery_model_front_female_tiktok'])
                        : ($gender === 'male' ? $prompts['embroidery_model_back_male_tiktok'] : $prompts['embroidery_model_back_female_tiktok']);
                } else {
                    $promptArray = $mockupSide === 'front' ? $prompts['embroidery_front_tiktok'] : $prompts['embroidery_back_tiktok'];
                }
            } else {
                if ($modelEnabled) {
                    $promptArray = ($mockupSide === 'front')
                        ? ($gender === 'male' ? $prompts['print_front_male_tiktok'] : $prompts['print_front_female_tiktok'])
                        : ($gender === 'male' ? $prompts['print_back_male_tiktok'] : $prompts['print_back_female_tiktok']);
                } else {
                    $promptArray = $mockupSide === 'front' ? $prompts['print_front_tiktok'] : $prompts['print_back_tiktok'];
                }
            }
        }

        $basePrompt = $promptArray[$promptKey] ?? $promptArray['T-shirt'];

        // Add color specification
        if ($color !== 'random') {
            $colorMap = ['black' => 'màu đen', 'white' => 'màu trắng', 'sand' => 'màu sand (be nhạt)'];
            $colorText = $colorMap[$color] ?? '';
            if ($colorText) {
                $basePrompt = str_replace('mockup ', "mockup $colorText ", $basePrompt);
            }
        }

        // Add model details
        if ($modelEnabled) {
            $poseText = $pose === 'standing' ? 'standing' : 'sitting';
            $basePrompt .= " Model is $poseText";
            if ($ageMin == $ageMax) {
                $basePrompt .= ", around $ageMin years old";
            } else {
                $basePrompt .= ", age range from $ageMin to $ageMax years old";
            }
            if ($hasReference) {
                $basePrompt .= ". CRITICAL FACE REQUIREMENT: You must COPY and CLONE the exact face from the reference image. The generated model MUST have IDENTICAL facial features: exact same face shape, identical eyes, identical nose, identical mouth, identical eyebrows, identical cheekbones, identical jawline, identical skin tone, identical facial proportions. The face must be an EXACT DUPLICATE. This is a face cloning task - copy every single facial detail from the reference image. DO NOT create a different person - CLONE the reference face completely";
            }
            if (!empty($customPrompt)) {
                $basePrompt .= ", " . trim($customPrompt);
            }
            $basePrompt .= ".";
        }

        return $basePrompt;
    }

    /**
     * All mockup prompts (from source)
     */
    private function getAllMockupPrompts() {
        return [
            'print_front' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie, phong cách tự nhiên, ánh sáng thật, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup áo Baby Rib Bodysuit, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ/nón, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup cốc/ly, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'print_back' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup áo Baby Rib Bodysuit, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ/nón, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup cốc/ly, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_front' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, dễ thương, có vật trang trí như gấu bông, chăn nhỏ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí nhỏ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí như sách, cây, bàn gỗ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_back' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, dễ thương, có vật trang trí như gấu bông, chăn nhỏ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí nhỏ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí như sách, cây, bàn gỗ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'print_model_front_male' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie, phong cách tự nhiên, ánh sáng thật, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'print_model_front_female' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie, phong cách tự nhiên, ánh sáng thật, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'print_model_back_male' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'print_model_back_female' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ, góc nhìn từ phía sau, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_front_male' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, dễ thương, có vật trang trí như gấu bông, chăn nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí như sách, cây, bàn gỗ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_front_female' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, dễ thương, có vật trang trí như gấu bông, chăn nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí như sách, cây, bàn gỗ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_back_male' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, dễ thương, có vật trang trí như gấu bông, chăn nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí như sách, cây, bàn gỗ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_back_female' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng mềm, bối cảnh đẹp, có vật trang trí. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, dễ thương, có vật trang trí như gấu bông, chăn nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, ánh sáng tự nhiên, bối cảnh lifestyle, có vật trang trí nhỏ. Mockup phù hợp để đăng bán trên Etsy. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, phong cách tự nhiên, ánh sáng thật, bối cảnh đẹp, có vật trang trí như sách, cây, bàn gỗ. Mockup phù hợp để đăng bán trên Etsy. Ảnh kích thước 1024x1024.'
            ],
            // TikTok variants
            'print_front_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'print_back_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'print_front_male_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'print_front_female_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'print_back_male_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'print_back_female_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_front_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_back_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ dạng thêu, góc nhìn từ phía sau, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí, không có người mẫu. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_front_male_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt dạng thêu, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit dạng thêu, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ dạng thêu, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_front_female_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo T-shirt dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt trước mockup áo Hoodie dạng thêu, đường chỉ ngang rõ nét, phong cách thêu thật, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt trước mockup áo Sweatshirt dạng thêu, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt trước mockup Baby Rib Bodysuit dạng thêu, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt trước mockup mũ dạng thêu, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_back_male_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nam kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
            'embroidery_model_back_female_tiktok' => [
                'T-shirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo T-shirt dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Hooded' => 'Vẽ lại thiết kế trên mặt sau mockup áo Hoodie dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Sweatshirt' => 'Vẽ lại thiết kế trên mặt sau mockup áo Sweatshirt dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Baby Rib Bodysuit' => 'Vẽ lại thiết kế trên mặt sau mockup Baby Rib Bodysuit dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.',
                'Hat' => 'Vẽ lại thiết kế trên mặt sau mockup mũ dạng thêu, góc nhìn từ phía sau, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Có người mẫu nữ kiểu người Âu - Mỹ. Ảnh kích thước 1024x1024.',
                'Mug' => 'Vẽ lại thiết kế trên mockup ly sứ, nền trắng hoàn toàn, ánh sáng đều, không có vật trang trí. Mockup phù hợp để đăng bán trên TikTok Shop. Ảnh kích thước 1024x1024.'
            ],
        ];
    }

    /**
     * Proxy call to PhotoRoom API for background removal
     */
    public function callPhotoroomApi($imageBase64) {
        if (empty($this->photoroomApiKey)) {
            throw new Exception('PhotoRoom API key not configured on server');
        }

        $imageData = base64_decode($imageBase64);
        if ($imageData === false) {
            throw new Exception('Invalid base64 image data');
        }

        // Build multipart form data
        $boundary = uniqid('boundary_');
        $body = '';
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Disposition: form-data; name=\"image_file\"; filename=\"image.png\"\r\n";
        $body .= "Content-Type: image/png\r\n\r\n";
        $body .= $imageData . "\r\n";
        $body .= "--{$boundary}--\r\n";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://sdk.photoroom.com/v1/segment',
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => [
                "Content-Type: multipart/form-data; boundary={$boundary}",
                "x-api-key: {$this->photoroomApiKey}",
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('PhotoRoom API cURL error: ' . $error);
        }

        if ($httpCode >= 400) {
            throw new Exception("PhotoRoom API error: HTTP $httpCode");
        }

        if ($response && strlen($response) > 0) {
            return [
                'success' => true,
                'imageBase64' => base64_encode($response),
            ];
        }

        throw new Exception('PhotoRoom API returned empty response');
    }

    /**
     * Start an Upscayl upscaling task
     */
    public function startUpscaylTask($imageBase64, $scale = 4, $model = 'upscayl-standard', $enhanceFace = false) {
        if (empty($this->upscaylApiKey)) {
            throw new Exception('Upscayl API key not configured on server');
        }

        $imageData = base64_decode($imageBase64);
        if ($imageData === false) {
            throw new Exception('Invalid base64 image data');
        }

        // Map model names to Upscayl API format (matching original DesignToolController)
        $modelMapping = [
            'upscayl-standard' => 'upscayl-standard-4x',
            'real-resolution' => 'real-esrgan-4x',
            'quick-clear' => 'quick-clear-4x',
            'digital-art' => 'digital-art-4x',
            'crystal-plus' => 'crystal-plus-4x',
            'clear-boost' => 'clear-boost-4x',
            'upscayl-lite' => 'upscayl-lite-4x',
            'natural-max' => 'natural-max-4x',
            'natural-plus' => 'natural-plus-4x',
            'nature-boost' => 'nature-boost-4x',
            'pure-boost' => 'pure-boost-4x',
            'texture-boost' => 'texture-boost-4x',
        ];
        $upscaylModel = $modelMapping[$model] ?? $model;

        // Build multipart form data
        $boundary = uniqid('boundary_');
        $body = '';

        // File field
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"image.png\"\r\n";
        $body .= "Content-Type: image/png\r\n\r\n";
        $body .= $imageData . "\r\n";

        // Other fields
        $fields = [
            'model' => $upscaylModel,
            'scale' => (string)$scale,
            'saveImageAs' => 'png',
            'enhanceFace' => $enhanceFace ? 'true' : 'false',
        ];
        foreach ($fields as $name => $value) {
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Disposition: form-data; name=\"{$name}\"\r\n\r\n";
            $body .= "{$value}\r\n";
        }
        $body .= "--{$boundary}--\r\n";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://api.upscayl.org/start-task',
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => [
                "Content-Type: multipart/form-data; boundary={$boundary}",
                "X-API-Key: {$this->upscaylApiKey}",
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Upscayl API cURL error: ' . $error);
        }

        $data = json_decode($response, true);
        if (!$data || ($data['status'] ?? '') !== 'success') {
            throw new Exception('Upscayl start task failed: ' . ($response ?: 'empty response'));
        }

        $taskId = $data['data']['taskId'] ?? null;
        if (!$taskId) {
            throw new Exception('No taskId returned from Upscayl API');
        }

        return [
            'success' => true,
            'taskId' => $taskId,
        ];
    }

    /**
     * Check Upscayl task status
     */
    public function getUpscaylStatus($taskId) {
        if (empty($this->upscaylApiKey)) {
            throw new Exception('Upscayl API key not configured on server');
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://api.upscayl.org/get-task-status',
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['data' => ['taskId' => $taskId]]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                "X-API-Key: {$this->upscaylApiKey}",
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Upscayl status cURL error: ' . $error);
        }

        $data = json_decode($response, true);
        if (!$data || ($data['status'] ?? '') !== 'success') {
            return ['success' => false, 'status' => 'UNKNOWN'];
        }

        $taskData = $data['data'] ?? [];
        $status = $taskData['status'] ?? 'UNKNOWN';

        $result = [
            'success' => true,
            'status' => $status,
        ];

        // If completed, include download link
        if ($status === 'PROCESSED' || $status === 'COMPLETED') {
            $downloadLink = $taskData['files'][0]['downloadLink'] ?? $taskData['files'][0]['path'] ?? null;
            $result['downloadLink'] = $downloadLink;
        }

        if ($status === 'FAILED' || $status === 'ERROR') {
            $result['error'] = $taskData['error'] ?? 'Unknown error';
        }

        return $result;
    }

    /**
     * Download Upscayl result and return as base64
     */
    public function downloadUpscaylResult($downloadUrl) {
        if (empty($this->upscaylApiKey)) {
            throw new Exception('Upscayl API key not configured on server');
        }

        if (!str_starts_with($downloadUrl, 'http')) {
            $downloadUrl = "https://api.upscayl.org/download/{$downloadUrl}";
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $downloadUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => [
                "X-API-Key: {$this->upscaylApiKey}",
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Upscayl download cURL error: ' . $error);
        }

        if ($httpCode >= 400) {
            throw new Exception("Upscayl download error: HTTP $httpCode");
        }

        if ($response && strlen($response) > 0) {
            return [
                'success' => true,
                'imageBase64' => base64_encode($response),
                'size' => strlen($response),
            ];
        }

        throw new Exception('Upscayl download returned empty response');
    }

    // ==================== Video Script Generation (Vertex AI) ====================

    /**
     * Generate a video script from an image using Vertex AI (gemini-3.1-pro-preview)
     */
    public function generateVideoScript($imageBase64, $duration = '10', $animation = 'zoom') {
        $prompt = "Nhìn vào hình ảnh này và tạo một script video giới thiệu sản phẩm áo một cách tự nhiên bằng tiếng Việt.\n\n";
        $prompt .= "CHỈ TRẢ VỀ SCRIPT, KHÔNG GIẢI THÍCH GÌ THÊM.\n\n";
        $prompt .= "Script phải:\n";
        $prompt .= "- Tập trung giới thiệu chiếc áo/trang phục trong hình một cách tự nhiên\n";
        $prompt .= "- Mô tả chi tiết chuyển động để khoe áo ({$duration} giây video)\n";
        $prompt .= "- Bao gồm: góc quay, cử chỉ, biểu cảm, ánh sáng\n";
        $prompt .= "- Tạo cảm giác tự nhiên như người mẫu đang tự tin khoe trang phục\n";
        $prompt .= "- Nhấn mạnh đặc điểm nổi bật của áo (màu sắc, kiểu dáng, chất liệu)\n\n";
        $prompt .= "Ví dụ format: \"Cô gái mặc áo sơ mi trắng đứng trước gương, từ từ xoay người để khoe thiết kế, tay vuốt nhẹ qua vải áo, ánh sáng tự nhiên làm nổi bật chất liệu mềm mại, cô mỉm cười tự tin khi nhìn vào camera, sau đó điều chỉnh cổ áo một cách thanh lịch.\"\n\n";
        $prompt .= "CHỈ VIẾT SCRIPT CHI TIẾT, KHÔNG VIẾT GÌ KHÁC.";

        // Detect mime type from base64 header or default to jpeg
        $mimeType = 'image/jpeg';

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mimeType,
                                'data'      => $imageBase64,
                            ]
                        ]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature'     => 0.7,
                'topK'            => 40,
                'topP'            => 0.95,
                'maxOutputTokens' => 2048,
            ]
        ];

        // Use Vertex AI endpoint with gemini-3.1-pro-preview model
        $accessToken = $this->getVertexAccessToken();
        $scriptLocation = $this->scriptVertexLocation;
        $scriptModel = $this->scriptVertexModel;
        $apiHost = $scriptLocation === 'global'
            ? 'aiplatform.googleapis.com'
            : "{$scriptLocation}-aiplatform.googleapis.com";
        $url = "https://{$apiHost}/v1/projects/{$this->vertexProjectId}/locations/{$scriptLocation}/publishers/google/models/{$scriptModel}:generateContent";

        // Retry logic for 503 errors (max 3 attempts)
        $maxRetries = 3;
        $attempt = 0;
        $response = null;
        $httpCode = 0;

        while ($attempt < $maxRetries) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $url,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => json_encode($payload),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 60,
                CURLOPT_HTTPHEADER     => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $accessToken,
                ],
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                throw new Exception('Vertex AI script gen cURL error: ' . $error);
            }

            if ($httpCode === 200) {
                break;
            }

            // Retry on 503 (service unavailable) or 429 (rate limit)
            if ($httpCode === 503 || $httpCode === 429) {
                $attempt++;
                if ($attempt < $maxRetries) {
                    $waitTime = pow(2, $attempt - 1);
                    sleep($waitTime);
                    continue;
                }
            }

            // Other errors - don't retry
            throw new Exception("Vertex AI script gen HTTP error: $httpCode");
        }

        if ($httpCode !== 200) {
            throw new Exception("Vertex AI script gen failed after {$maxRetries} retries. HTTP: $httpCode");
        }

        $result = json_decode($response, true);
        $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (!$text) {
            throw new Exception('Vertex AI returned no script text');
        }

        // Clean up the script - remove markdown code blocks
        $cleanedScript = trim($text);
        if (strpos($cleanedScript, '```') === 0) {
            $lines = explode("\n", $cleanedScript);
            $cleanedLines = [];
            foreach ($lines as $line) {
                if (strpos($line, '```') !== 0) {
                    $cleanedLines[] = $line;
                }
            }
            $cleanedScript = implode("\n", $cleanedLines);
        }

        // Strip remaining markdown formatting
        $cleanedScript = preg_replace('/\*\*(.+?)\*\*/', '$1', $cleanedScript);
        $cleanedScript = preg_replace('/\*(.+?)\*/', '$1', $cleanedScript);
        $cleanedScript = preg_replace('/^#{1,6}\s*/m', '', $cleanedScript);
        $cleanedScript = preg_replace('/^---+$/m', '', $cleanedScript);
        $cleanedScript = preg_replace('/\n{3,}/', "\n\n", $cleanedScript);
        $cleanedScript = trim($cleanedScript);

        return [
            'success' => true,
            'script'  => $cleanedScript,
        ];
    }

    // ==================== Kling Video Service Methods ====================

    /**
     * Base64 URL encode for JWT
     */
    private function base64urlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Generate JWT token for Kling API authentication
     */
    private function encodeKlingJwtToken() {
        $headers = json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES);
        $payload = json_encode([
            'iss' => $this->klingAccessKey,
            'exp' => time() + 1800,
            'nbf' => time() - 5,
        ], JSON_UNESCAPED_SLASHES);

        $encodedHeader = $this->base64urlEncode($headers);
        $encodedPayload = $this->base64urlEncode($payload);

        $message = "{$encodedHeader}.{$encodedPayload}";
        $signature = hash_hmac('sha256', $message, $this->klingSecretKey, true);
        $encodedSignature = $this->base64urlEncode($signature);

        return "{$encodedHeader}.{$encodedPayload}.{$encodedSignature}";
    }

    /**
     * Get Kling API auth headers
     */
    private function getKlingAuthHeaders() {
        $token = $this->encodeKlingJwtToken();
        return [
            "Authorization: Bearer {$token}",
            'Content-Type: application/json',
        ];
    }

    /**
     * Map frontend AI model ID to Kling API model_name + mode
     */
    private function mapKlingModel($aiModel) {
        $mapping = [
            'kling-v2-6-std'   => ['model' => 'kling-v2-6', 'mode' => 'std'],
            'kling-v2-6-pro'   => ['model' => 'kling-v2-6', 'mode' => 'pro'],
            'kling-v2-5-turbo' => ['model' => 'kling-v2-5-turbo', 'mode' => 'pro'],
            'kling-v2-1-std'   => ['model' => 'kling-v2-1', 'mode' => 'std'],
            'kling-v2-1-pro'   => ['model' => 'kling-v2-1', 'mode' => 'pro'],
            'kling-v1-6-std'   => ['model' => 'kling-v1-6', 'mode' => 'std'],
            'kling-v1-6-pro'   => ['model' => 'kling-v1-6', 'mode' => 'pro'],
        ];
        return $mapping[$aiModel] ?? ['model' => 'kling-v2-1', 'mode' => 'std'];
    }

    /**
     * Create a single-image video generation task
     */
    public function createVideoTask($imageBase64, $prompt, $aiModel, $duration = '10') {
        if (empty($this->klingAccessKey) || empty($this->klingSecretKey)) {
            throw new Exception('Kling API credentials not configured');
        }

        $mapped = $this->mapKlingModel($aiModel);

        // Truncate prompt to max 2500 chars (Kling API limit)
        if (strlen($prompt) > 2500) {
            $prompt = substr($prompt, 0, 2497) . '...';
        }
  
        $data = [
            'model_name'   => $mapped['model'],
            'mode'         => $mapped['mode'],
            'duration'     => $duration,
            'image'        => $imageBase64,
            'prompt'       => $prompt,
            'cfg_scale'    => 0.5,
            'aspect_ratio' => '9:16',
        ];

        $url = $this->klingApiDomain . '/v1/videos/image2video';
        $headers = $this->getKlingAuthHeaders();

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => $headers,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Kling API cURL error: ' . $error);
        }

        $result = json_decode($response, true);
        if (!$result) {
            throw new Exception("Kling API returned invalid JSON. HTTP $httpCode");
        }

        if (($result['code'] ?? -1) !== 0) {
            throw new Exception('Kling API error: ' . ($result['message'] ?? 'Unknown'));
        }

        $taskId = $result['data']['task_id'] ?? null;
        if (!$taskId) {
            throw new Exception('Kling API returned no task_id');
        }

        return [
            'success' => true,
            'taskId'  => $taskId,
        ];
    }

    /**
     * Create a dual-image video generation task (Kling V2.1 Pro with image_tail)
     */
    public function createDualImageVideoTask($imageBase64, $secondImageBase64, $prompt, $aiModel, $duration = '10') {
        if (empty($this->klingAccessKey) || empty($this->klingSecretKey)) {
            throw new Exception('Kling API credentials not configured');
        }

        $mapped = $this->mapKlingModel($aiModel);

        // Truncate prompt to max 2500 chars (Kling API limit)
        if (strlen($prompt) > 2500) {
            $prompt = substr($prompt, 0, 2497) . '...';
        }

        $data = [
            'model_name'   => $mapped['model'],
            'mode'         => $mapped['mode'],
            'duration'     => $duration,
            'image'        => $imageBase64,
            'image_tail'   => $secondImageBase64,
            'prompt'       => $prompt,
            'cfg_scale'    => 0.5,
            'aspect_ratio' => '9:16',
        ];

        $url = $this->klingApiDomain . '/v1/videos/image2video';
        $headers = $this->getKlingAuthHeaders();

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => $headers,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Kling dual-image cURL error: ' . $error);
        }

        $result = json_decode($response, true);
        if (!$result) {
            throw new Exception("Kling dual-image API returned invalid JSON. HTTP $httpCode");
        }

        if (($result['code'] ?? -1) !== 0) {
            throw new Exception('Kling dual-image API error: ' . ($result['message'] ?? 'Unknown'));
        }

        $taskId = $result['data']['task_id'] ?? null;
        if (!$taskId) {
            throw new Exception('Kling dual-image API returned no task_id');
        }

        return [
            'success' => true,
            'taskId'  => $taskId,
        ];
    }

    /**
     * Create a motion control video generation task
     */
    public function createMotionControlTask($referenceImageBase64, $videoUrl, $prompt, $mode, $keepOriginalSound) {
        if (empty($this->klingAccessKey) || empty($this->klingSecretKey)) {
            throw new Exception('Kling API credentials not configured');
        }

        $data = [
            'image_url'             => $referenceImageBase64,
            'video_url'             => $videoUrl,
            'character_orientation' => 'image',
            'mode'                  => $mode,
            'keep_original_sound'   => $keepOriginalSound,
        ];

        if (!empty($prompt)) {
            $data['prompt'] = substr($prompt, 0, 2500);
        }

        $url = $this->klingApiDomain . '/v1/videos/motion-control';
        $headers = $this->getKlingAuthHeaders();

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => $headers,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Kling motion control cURL error: ' . $error);
        }

        $result = json_decode($response, true);
        if (!$result) {
            throw new Exception("Kling motion control API returned invalid JSON. HTTP $httpCode");
        }

        if (($result['code'] ?? -1) !== 0) {
            throw new Exception('Kling motion control API error: ' . ($result['message'] ?? 'Unknown'));
        }

        $taskId = $result['data']['task_id'] ?? null;
        if (!$taskId) {
            throw new Exception('Kling motion control API returned no task_id');
        }

        return [
            'success' => true,
            'taskId'  => $taskId,
        ];
    }

    /**
     * Query video task status (image2video)
     */
    public function queryVideoTaskStatus($taskId, $isMotionControl = false) {
        if (empty($this->klingAccessKey) || empty($this->klingSecretKey)) {
            throw new Exception('Kling API credentials not configured');
        }

        if ($isMotionControl) {
            $url = $this->klingApiDomain . "/v1/videos/motion-control/{$taskId}";
        } else {
            $url = $this->klingApiDomain . "/v1/videos/image2video/{$taskId}";
        }

        $headers = $this->getKlingAuthHeaders();

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => $headers,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Kling status cURL error: ' . $error);
        }

        $result = json_decode($response, true);
        if (!$result) {
            throw new Exception("Kling status API returned invalid JSON. HTTP $httpCode");
        }

        if (($result['code'] ?? -1) !== 0) {
            throw new Exception('Kling status API error: ' . ($result['message'] ?? 'Unknown'));
        }

        $taskStatus = $result['data']['task_status'] ?? 'unknown';
        $response = [
            'success' => true,
            'status'  => $taskStatus,
        ];

        if ($taskStatus === 'succeed') {
            $videos = $result['data']['task_result']['videos'] ?? [];
            if (!empty($videos)) {
                $response['videoUrl'] = $videos[0]['url'] ?? null;
            }
        } elseif ($taskStatus === 'failed') {
            $response['error'] = $result['data']['task_status_msg'] ?? 'Video generation failed';
        }

        return $response;
    }

    /**
     * Download video from Kling result URL and return as base64
     */
    public function downloadVideoResult($videoUrl) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $videoUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 180,
            CURLOPT_FOLLOWLOCATION => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Video download cURL error: ' . $error);
        }

        if ($httpCode >= 400) {
            throw new Exception("Video download error: HTTP $httpCode");
        }

        if ($response && strlen($response) > 0) {
            return [
                'success'     => true,
                'videoBase64' => base64_encode($response),
                'size'        => strlen($response),
            ];
        }

        throw new Exception('Video download returned empty response');
    }
}
