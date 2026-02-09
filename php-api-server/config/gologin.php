<?php
class GoLoginAPI {
    private $apiToken;
    private $baseUrl = 'https://api.gologin.com';

    public function __construct() {
        $this->apiToken = $_ENV['GOLOGIN_API_TOKEN'] ?? '';
        if (empty($this->apiToken)) {
            throw new Exception("GoLogin API token is required");
        }
    }

    private function makeRequest($endpoint, $method = 'GET', $data = null) {
        $url = $this->baseUrl . $endpoint;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        // Enable HTTP/2 support (like terminal cURL)
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);
        
        // Set User-Agent to match working cURL (CRITICAL!)
        curl_setopt($ch, CURLOPT_USERAGENT, 'curl/7.61.1');
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiToken,
            'Content-Type: application/json',
            'Accept: */*'
        ]);

        switch ($method) {
            case 'POST':
                curl_setopt($ch, CURLOPT_POST, true);
                if ($data) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                }
                break;
            case 'PUT':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
                if ($data) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                }
                break;
            case 'PATCH':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                if ($data) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                }
                break;
            case 'DELETE':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
                break;
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            throw new Exception("cURL error: " . curl_error($ch));
        }

        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $errorMessage = 'Unknown error';
            if (is_array($decodedResponse)) {
                // Try to extract error message from various possible fields
                if (isset($decodedResponse['message'])) {
                    $errorMessage = $decodedResponse['message'];
                } elseif (isset($decodedResponse['error'])) {
                    $errorMessage = is_array($decodedResponse['error']) ? json_encode($decodedResponse['error']) : $decodedResponse['error'];
                } elseif (isset($decodedResponse['errors'])) {
                    $errorMessage = is_array($decodedResponse['errors']) ? implode(', ', $decodedResponse['errors']) : $decodedResponse['errors'];
                } else {
                    // If no standard error field, show the entire response
                    $errorMessage = json_encode($decodedResponse, JSON_PRETTY_PRINT);
                }
            } elseif (is_string($decodedResponse)) {
                $errorMessage = $decodedResponse;
            } else {
                $errorMessage = $response; // Show raw response if not JSON
            }
            
            // Log the full error for debugging
            error_log("GoLogin API Error (HTTP $httpCode): " . $errorMessage);
            
            throw new Exception("GoLogin API error: " . $errorMessage);
        }

        // Return successful response - could be array or object
        return $decodedResponse;
    }

    public function listProfiles($page = 1, $search = null, $folder = null) {
        $params = ['page' => $page];
        if ($search) $params['search'] = $search;
        if ($folder) $params['folder'] = $folder;
        
        $queryString = http_build_query($params);
        return $this->makeRequest('/browser/v2?' . $queryString);
    }

    public function getProfile($profileId) {
        return $this->makeRequest('/browser/' . $profileId);
    }

    public function createProfile($profileData) {
        return $this->makeRequest('/browser/custom', 'POST', $profileData);
    }

    public function createQuickProfile($os, $name, $osSpec = null) {
        $data = [
            'name' => $name,
            'os' => $os
        ];
        if ($osSpec) {
            $data['osSpec'] = $osSpec;
        }
        return $this->makeRequest('/browser/quick', 'POST', $data);
    }

    public function updateProfile($profileId, $profileData) {
        return $this->makeRequest('/browser/' . $profileId, 'PUT', $profileData);
    }

    public function deleteProfile($profileId) {
        return $this->makeRequest('/browser/' . $profileId, 'DELETE');
    }

    public function setProfileProxy($profileId, $proxy) {
        return $this->makeRequest('/browser/' . $profileId . '/proxy', 'PUT', $proxy);
    }

    public function removeProfileProxy($profileId) {
        return $this->makeRequest('/browser/' . $profileId . '/proxy', 'DELETE');
    }

    public function launchProfile($profileId, $options = []) {
        return $this->makeRequest('/browser/' . $profileId . '/start', 'POST', $options);
    }

    public function stopProfile($profileId) {
        return $this->makeRequest('/browser/' . $profileId . '/stop', 'POST');
    }

    public function listFolders() {
        return $this->makeRequest('/folders');
    }

    public function createFolder($name) {
        return $this->makeRequest('/folders/folder', 'POST', [
            'name' => $name,
            'associatedProfiles' => []
        ]);
    }

    public function updateFolder($folderName, $newName) {
        // GoLogin API uses folder name for updates
        return $this->makeRequest('/folders/folder', 'PATCH', [
            'name' => $folderName,
            'newName' => $newName
        ]);
    }

    public function deleteFolder($folderName) {
        // GoLogin API uses folder name for deletion
        return $this->makeRequest('/folders/folder?name=' . urlencode($folderName), 'DELETE');
    }

    public function addProfilesToFolder($folderName, $profileIds) {
        return $this->makeRequest('/folders/folder', 'PATCH', [
            'name' => $folderName,
            'profiles' => is_array($profileIds) ? $profileIds : [$profileIds],
            'action' => 'add'
        ]);
    }

    public function removeProfilesFromFolder($folderName, $profileIds) {
        return $this->makeRequest('/folders/folder', 'PATCH', [
            'name' => $folderName,
            'profiles' => is_array($profileIds) ? $profileIds : [$profileIds],
            'action' => 'remove'
        ]);
    }

    public function getTags() {
        return $this->makeRequest('/tags');
    }

    public function getProxyLocations() {
        return $this->makeRequest('/proxy-locations');
    }

    public function testConnection() {
        try {
            $this->makeRequest('/browser/v2?page=1');
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    public function renameFolder($oldName, $newName) {
        // Alternative method using folder name
        return $this->makeRequest('/folders/folder', 'PATCH', [
            'name' => $oldName,
            'newName' => $newName
        ]);
    }
}
?>
