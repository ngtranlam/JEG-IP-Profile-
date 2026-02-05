<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/gologin.php';

echo "<h2>GoLogin API Debug Test</h2>";

try {
    $gologinAPI = new GoLoginAPI();
    
    echo "<h3>1. Test Connection</h3>";
    $testResult = $gologinAPI->testConnection();
    echo "Connection: " . ($testResult ? "✅ Success" : "❌ Failed") . "<br><br>";
    
    echo "<h3>2. Test List Folders</h3>";
    $folders = $gologinAPI->listFolders();
    echo "Folders response type: " . gettype($folders) . "<br>";
    echo "Folders content: <pre>" . print_r($folders, true) . "</pre><br>";
    
    echo "<h3>3. Test List Profiles</h3>";
    $profiles = $gologinAPI->listProfiles(1);
    echo "Profiles response type: " . gettype($profiles) . "<br>";
    echo "Profiles content: <pre>" . print_r($profiles, true) . "</pre><br>";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "<br>";
    echo "Error details: <pre>" . $e->getTraceAsString() . "</pre>";
}
?>
