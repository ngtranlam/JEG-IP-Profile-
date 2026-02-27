# GitHub Secrets Setup

Để build app thành công, bạn cần thêm các secrets sau vào GitHub repository:

## Bước 1: Vào Settings

1. Vào repository: https://github.com/ngtranlam/JEG-IP-Profile-
2. Click **Settings** (tab phía trên)
3. Bên trái, click **Secrets and variables** → **Actions**
4. Click **New repository secret**

## Bước 2: Thêm Secrets

### Secret 1: GOLOGIN_API_TOKEN

- **Name:** `GOLOGIN_API_TOKEN`
- **Value:** Token GoLogin của bạn (lấy từ https://gologin.com/settings/api)
- Click **Add secret**

### Secret 2: API_BASE_URL

- **Name:** `API_BASE_URL`
- **Value:** `https://profile.jegdn.com/api`
- Click **Add secret**

## Bước 3: Trigger Build

Sau khi thêm secrets:

1. Vào tab **Actions**
2. Click workflow **Build Electron App**
3. Click **Run workflow** → Chọn branch `main` → **Run workflow**

Hoặc push code mới:
```bash
git commit --allow-empty -m "Trigger build with secrets"
git push origin main
```

## Kiểm tra

Build sẽ tự động tạo file `.env` với nội dung:
```
GOLOGIN_API_TOKEN=<your_token>
API_BASE_URL=https://profile.jegdn.com/api
```

File này sẽ được đóng gói vào app, user không cần tự tạo `.env` nữa.

## Bảo mật

✅ Secrets được mã hóa và chỉ hiển thị khi build
✅ Không ai có thể xem secrets sau khi thêm
✅ Chỉ admin repository mới thêm/sửa được secrets
