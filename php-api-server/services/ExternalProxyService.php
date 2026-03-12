<?php

class ExternalProxyService {
    private $baseUrl = 'https://jegdn.com/api/proxy';
    private $apiKey = 'JEGTECHNOLOGY@2026';

    /**
     * Make a request to the external proxy API
     */
    private function makeRequest($endpoint, $method = 'GET', $body = null, $queryParams = []) {
        $url = $this->baseUrl . $endpoint;
        
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        
        $headers = [
            'X-API-Key: ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("External API request failed: $error");
        }

        $data = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $message = $data['message'] ?? "External API error (HTTP $httpCode)";
            throw new Exception($message);
        }

        return $data;
    }

    /**
     * Get proxy list
     * Admin: pass username to filter by seller, or null for all
     * Seller/Leader: pass their own username
     */
    public function getProxyList($username, $filters = []) {
        $queryParams = [];
        
        if (!empty($filters['status'])) {
            $queryParams['status'] = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $queryParams['search'] = $filters['search'];
        }
        if (!empty($filters['country'])) {
            $queryParams['country'] = $filters['country'];
        }
        if (!empty($filters['network'])) {
            $queryParams['network'] = $filters['network'];
        }
        if (!empty($filters['isp'])) {
            $queryParams['isp'] = $filters['isp'];
        }

        $headers = ['X-Username: ' . $username];
        
        $url = $this->baseUrl . '/list';
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge([
            'X-API-Key: ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ], $headers));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("External API request failed: $error");
        }

        $data = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $message = $data['message'] ?? "External API error (HTTP $httpCode)";
            throw new Exception($message);
        }

        return $data;
    }

    /**
     * Get proxy statistics
     */
    public function getProxyStats($username) {
        return $this->makeRequestWithUsername('/stats', 'GET', $username);
    }

    /**
     * Get proxy detail
     */
    public function getProxyDetail($username, $proxyId) {
        return $this->makeRequestWithUsername("/detail/$proxyId", 'GET', $username);
    }

    /**
     * Get order options
     */
    public function getOrderOptions($username, $serviceType = 'static-residential-ipv4', $planId = 'standard') {
        return $this->makeRequestWithUsername('/order-options', 'POST', $username, [
            'service_type' => $serviceType,
            'plan_id' => $planId,
        ]);
    }

    /**
     * Calculate order price
     */
    public function calculatePrice($username, $orderData) {
        return $this->makeRequestWithUsername('/calculate-price', 'POST', $username, $orderData);
    }

    /**
     * Place proxy order
     */
    public function placeOrder($username, $orderData) {
        return $this->makeRequestWithUsername('/order', 'POST', $username, $orderData);
    }

    /**
     * Sync proxies
     */
    public function syncProxies($username) {
        return $this->makeRequestWithUsername('/sync', 'POST', $username);
    }

    // ===== v2 WRITE ENDPOINTS =====

    /**
     * Update proxy note
     */
    public function updateNote($username, $proxyId, $notes) {
        return $this->makeRequestWithUsername("/update-note/$proxyId", 'POST', $username, [
            'notes' => $notes,
        ]);
    }

    /**
     * Calculate extension price
     */
    public function getExtensionPrice($username, $proxyId, $periodInMonths) {
        return $this->makeRequestWithUsername('/extension-price', 'POST', $username, [
            'proxy_id' => $proxyId,
            'period_in_months' => $periodInMonths,
        ]);
    }

    /**
     * Extend proxy period
     */
    public function extendProxy($username, $proxyId, $periodInMonths, $couponCode = null) {
        $body = [
            'proxy_id' => $proxyId,
            'period_in_months' => $periodInMonths,
        ];
        if ($couponCode) {
            $body['coupon_code'] = $couponCode;
        }
        return $this->makeRequestWithUsername('/extend', 'POST', $username, $body);
    }

    /**
     * Add manual proxy
     */
    public function addManualProxy($username, $data) {
        return $this->makeRequestWithUsername('/add-manual', 'POST', $username, $data);
    }

    /**
     * Update manual proxy expiration
     */
    public function updateManualExpiration($username, $proxyId, $expiresAt) {
        return $this->makeRequestWithUsername('/update-manual-expiration', 'POST', $username, [
            'proxy_id' => $proxyId,
            'expires_at' => $expiresAt,
        ]);
    }

    /**
     * Change whitelisted IPs
     */
    public function changeWhitelistedIps($username, $proxyId, $ips) {
        return $this->makeRequestWithUsername('/change-whitelisted-ips', 'POST', $username, [
            'proxy_id' => $proxyId,
            'ips' => $ips,
        ]);
    }

    /**
     * Get sellers list (Admin only)
     */
    public function getSellers($username) {
        return $this->makeRequestWithUsername('/sellers', 'GET', $username);
    }

    /**
     * Update proxy seller assignment (Admin only)
     */
    public function updateSeller($username, $proxyId, $sellerUsername) {
        return $this->makeRequestWithUsername('/update-seller', 'POST', $username, [
            'proxy_id' => $proxyId,
            'seller_username' => $sellerUsername,
        ]);
    }

    /**
     * Delete proxy (Admin only)
     */
    public function deleteProxy($username, $proxyId, $reason = null) {
        $body = ['proxy_id' => $proxyId];
        if ($reason) {
            $body['reason'] = $reason;
        }
        return $this->makeRequestWithUsername('/delete', 'POST', $username, $body);
    }

    /**
     * Helper: make request with X-Username header
     */
    private function makeRequestWithUsername($endpoint, $method, $username, $body = null) {
        $url = $this->baseUrl . $endpoint;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        
        $headers = [
            'X-API-Key: ' . $this->apiKey,
            'X-Username: ' . $username,
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("External API request failed: $error");
        }

        $data = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $message = $data['message'] ?? "External API error (HTTP $httpCode)";
            throw new Exception($message);
        }

        return $data;
    }
}
?>
