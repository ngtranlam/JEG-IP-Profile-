# GitHub Actions Build

## Workflow tự động build app cho Windows và macOS

### Khi nào workflow chạy:
1. **Push code** lên branch `main` hoặc `master`
2. **Tạo Pull Request** vào branch `main` hoặc `master`
3. **Tạo tag** với format `v*` (ví dụ: `v1.0.0`)
4. **Chạy thủ công** từ GitHub Actions tab

### Cách sử dụng:

#### 1. Push code lên GitHub
```bash
git add .
git commit -m "Update app"
git push origin main
```

#### 2. Chạy workflow thủ công
1. Vào repository trên GitHub
2. Click tab **Actions**
3. Chọn workflow **Build Electron App**
4. Click **Run workflow**
5. Chọn branch và click **Run workflow**

#### 3. Tạo release với tag
```bash
# Tạo tag
git tag v1.0.0

# Push tag lên GitHub
git push origin v1.0.0
```

Workflow sẽ tự động:
- Build Windows app (trên Windows runner)
- Build macOS app (trên macOS runner)
- Tạo GitHub Release với tất cả files build

### Download build artifacts:

#### Từ Actions tab:
1. Vào **Actions** tab
2. Click vào workflow run
3. Scroll xuống **Artifacts**
4. Download:
   - `windows-build` - Windows installer và portable
   - `macos-build` - macOS DMG và ZIP

#### Từ Releases (nếu tạo tag):
1. Vào **Releases** tab
2. Click vào release version
3. Download files từ **Assets**

### Files được build:

**Windows:**
- `JEG Profile Manager Setup 1.0.0.exe` - Installer
- `JEG Profile Manager 1.0.0.exe` - Portable

**macOS:**
- `JEG Profile Manager-1.0.0.dmg` - Intel Mac
- `JEG Profile Manager-1.0.0-arm64.dmg` - Apple Silicon
- `JEG Profile Manager-1.0.0-mac.zip` - Intel Mac (zip)
- `JEG Profile Manager-1.0.0-arm64-mac.zip` - Apple Silicon (zip)

### Lưu ý:

1. **File .env không được commit** - Cần thêm vào `.gitignore`
2. **Secrets** - Nếu cần API keys, thêm vào GitHub Secrets
3. **Build time** - Mỗi lần build mất khoảng 5-10 phút
4. **Artifacts retention** - Files build được giữ 30 ngày
