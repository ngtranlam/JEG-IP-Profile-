# Hướng dẫn cài đặt JEG Profile Manager

## Vấn đề: "App is damaged and can't be opened"

Khi tải app từ internet, macOS sẽ block app vì lý do bảo mật.

## Cách 1: Sử dụng script tự động

1. Mở Terminal
2. Chạy lệnh:
```bash
xattr -cr "/Applications/JEG Profile Manager.app"
```

Hoặc nếu app ở Desktop:
```bash
xattr -cr "~/Desktop/JEG Profile Manager.app"
```

## Cách 2: Mở thủ công

1. **Click phải** vào app
2. Chọn **Open** (không phải double-click)
3. Click **Open** trong dialog xuất hiện

## Cách 3: Tắt Gatekeeper (không khuyến khích)

```bash
sudo spctl --master-disable
```

Sau khi mở app, bật lại:
```bash
sudo spctl --master-enable
```

## Lưu ý

- Chỉ cần làm 1 lần duy nhất
- Sau khi mở được, app sẽ hoạt động bình thường
- Đảm bảo file `.env` có `GOLOGIN_API_TOKEN`
