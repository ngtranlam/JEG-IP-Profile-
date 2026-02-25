# Build JEG Profile Manager cho Windows

## Yêu cầu

- Node.js 18+
- npm hoặc yarn
- **Lưu ý:** Có thể build Windows app từ macOS

## Build từ macOS cho Windows

```bash
# Install dependencies
npm install

# Build Windows app
npm run package:win
```

## Kết quả build

Sau khi build xong, file sẽ nằm trong folder `release/`:

- `JEG Profile Manager Setup 1.0.0.exe` - Installer (NSIS)
- `JEG Profile Manager 1.0.0.exe` - Portable version (không cần cài đặt)

## Cài đặt trên Windows

### Cách 1: Dùng Installer (khuyến nghị)
1. Chạy file `JEG Profile Manager Setup 1.0.0.exe`
2. Chọn thư mục cài đặt
3. Hoàn tất cài đặt
4. App sẽ tự động tạo shortcut trên Desktop và Start Menu

### Cách 2: Dùng Portable
1. Giải nén file `JEG Profile Manager 1.0.0.exe`
2. Chạy trực tiếp, không cần cài đặt
3. Có thể copy sang USB và chạy trên máy khác

## Lưu ý quan trọng

### File .env
App cần file `.env` với `GOLOGIN_API_TOKEN`. Có 2 cách:

**Cách 1: Đặt .env cùng folder với .exe**
```
JEG Profile Manager/
├── JEG Profile Manager.exe
└── .env
```

**Cách 2: Đặt trong User Data folder**
```
C:\Users\<username>\AppData\Roaming\JEG Profile Manager\.env
```

### Nội dung file .env
```
GOLOGIN_API_TOKEN=your_token_here
API_BASE_URL=https://profile.jegdn.com/api
```

## Troubleshooting

### Windows Defender SmartScreen
Nếu Windows cảnh báo "Windows protected your PC":
1. Click "More info"
2. Click "Run anyway"

Hoặc tắt SmartScreen tạm thời:
1. Windows Security → App & browser control
2. Reputation-based protection settings
3. Tắt "Check apps and files"

### App không chạy
1. Kiểm tra file `.env` có đúng vị trí
2. Kiểm tra `GOLOGIN_API_TOKEN` có đúng
3. Chạy app từ Command Prompt để xem logs:
```cmd
"C:\Program Files\JEG Profile Manager\JEG Profile Manager.exe"
```
