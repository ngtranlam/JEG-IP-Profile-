# Performance Optimization Issues

## Vấn đề phát hiện (27/08/2026)

### 1. Load Profile quá nhiều lần
- `loadProfiles()` được gọi 12+ lần trong component
- Mỗi lần gọi fetch lại toàn bộ profiles từ API
- Không có debounce/throttle

**Locations:**
- Line 184: onBrowserClosed listener
- Line 334: useEffect [currentPage, searchTerm, selectedFolder]
- Line 727: After create profile
- Line 742, 747: After delete profile
- Line 791: After update folders
- Line 817: After save profile
- Line 886: After update proxy
- Line 968: After stop profile
- Line 1010: After update note
- Line 2330: After edit profile

### 2. Re-render không cần thiết
- Toàn bộ profile list re-render khi 1 profile thay đổi
- Không dùng React.memo cho ProfileCard
- State updates trigger full list re-render

### 3. Polling interval
- Fetch running profiles mỗi 15s (line 156)
- Có thể tăng lên 30s hoặc chỉ poll khi có profile running

### 4. Input lag issue
- Có thể do sync API calls block UI thread
- Cần move heavy operations sang Web Worker hoặc async queue

## Giải pháp đề xuất

### 1. Debounce loadProfiles
```typescript
const debouncedLoadProfiles = useMemo(
  () => debounce(loadProfiles, 300),
  []
);
```

### 2. Optimize re-render
```typescript
const ProfileCard = React.memo(({ profile, onLaunch, onEdit }) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.profile.id === nextProps.profile.id &&
         prevProps.profile.updatedAt === nextProps.profile.updatedAt;
});
```

### 3. Conditional polling
```typescript
const interval = runningProfileIds.size > 0 
  ? setInterval(fetchRunningProfiles, 15000)
  : setInterval(fetchRunningProfiles, 60000);
```

### 4. Batch updates
- Queue multiple updates và batch execute
- Sử dụng `startTransition` cho non-urgent updates

## Priority
1. **HIGH**: Debounce loadProfiles
2. **MEDIUM**: Memo ProfileCard
3. **LOW**: Conditional polling
