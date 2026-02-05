const admin = require("firebase-admin");

// 1. Thay đường dẫn đến file key bạn vừa tải về
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 2. Cấu hình bật TOTP
const config = {
  multiFactorConfig: {
    state: 'ENABLED',
    providerConfigs: [
      {
        state: 'ENABLED',
        totpProviderConfig: {
          adjacentIntervals: 5
        }
      }
    ]
  }
};

// 3. Gửi lệnh lên Google
admin.auth().projectConfigManager().updateProjectConfig(config)
.then(() => {
    console.log("✅ Đã bật thành công TOTP (Authenticator App) cho dự án của bạn!");
})
.catch((error) => {
    console.log("❌ Lỗi rồi:", error);
});
