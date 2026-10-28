# Planet BOS, the Pixel Gallery

Website nội bộ chứa toàn bộ logo, mascot, hình nền và vật liệu mini game của team BOS.
Mỗi ảnh có nút **Copy** (dán thẳng vào Google Slides / PowerPoint) và **Download**. Mỗi sảnh có nút tải cả sảnh dạng ZIP, góc phải có nút tải tất cả.

---

## 1. Hệ thống chạy thế nào

```
Google Drive (thư mục BOS-Asset)        ← upload ảnh ở đây như bình thường
        │  bấm nút Refresh trên website
        ▼
GitHub Actions ("robot" Sync gallery)   ← chép ảnh mới từ Drive, làm ảnh thu nhỏ
        ▼
GitHub repo này (kho chính)             ← BẢN SAO VĨNH VIỄN của mọi ảnh
        │  mỗi lần kho thay đổi
        ▼
Cloudflare (website)                    ← tự đăng lại trang sau khoảng 1 phút
        │
Cloudflare Access (bảo vệ cửa)          ← chỉ email được phép mới vào được
```

Ví von: **Drive là hộp thư**, **GitHub là cái kho**, **website là phòng trưng bày**.
Bấm Refresh là nhờ robot ra hộp thư lấy ảnh mới cất vào kho, rồi phòng trưng bày tự bày ra.
Khi hộp thư bị khoá (account Drive bị tắt), ảnh **đã nằm trong kho rồi**, website vẫn chạy bình thường.

Robot có "phanh an toàn": không đọc được Drive, hoặc Drive bỗng trống bất thường, thì nó **dừng lại, không xoá gì cả**.

## 2. Thư mục trong repo

| Đường dẫn | Là gì |
|---|---|
| `site/` | Toàn bộ website. Cloudflare chỉ đăng thư mục này. |
| `site/media/<sảnh>/` | Ảnh gốc (robot tự chép từ Drive). |
| `site/thumbs/`, `site/data/manifest.json` | Ảnh thu nhỏ và danh sách ảnh (robot tự tạo, đừng sửa tay). |
| `worker/index.js` | Máy chủ nhỏ phía sau nút Refresh. |
| `wrangler.jsonc` | Cấu hình Cloudflare (đăng thư mục `site`, bật nút Refresh). |
| `scripts/` | Code của robot. `categories.json` quy định tên và thứ tự các sảnh. |
| `.github/workflows/sync.yml` | Lịch làm việc của robot (chỉ chạy khi được gọi). |

> Lưu ý khi tải file lên bằng web GitHub: thư mục bắt đầu bằng dấu chấm như `.github` **không** được kéo-thả lên. Hãy tạo nó bằng **Add file → Create new file**, gõ tên `.github/workflows/sync.yml` rồi dán nội dung vào.

## 3. Thiết lập một lần

### 3.1 GitHub: chìa khoá đọc Drive (đã làm)
Repo → **Settings → Secrets and variables → Actions → Secrets**:
- `GDRIVE_ROOT_FOLDER_ID`: mã thư mục Drive (đoạn sau `/folders/` trong link).
- `GDRIVE_SA_KEY`: nội dung file JSON của service account. Thư mục Drive phải được chia sẻ quyền **Viewer** cho email của service account.

### 3.2 GitHub: token cho nút Refresh
Nút Refresh cần một "thẻ ra vào" để được phép bấm nút chạy robot.
1. Ảnh đại diện GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access**: *Only select repositories* → chọn `BOS-Asset-Museum`.
3. **Permissions → Repository permissions → Actions**: *Read and write*. Không cần quyền nào khác.
4. **Expiration**: chọn thời hạn dài nhất được phép, ghi lịch nhắc gia hạn.
5. Bấm Generate, copy token (chỉ hiện một lần).

### 3.3 Cloudflare: gắn token vào website
1. **Workers & Pages → bos-asset-museum → Settings → Variables and Secrets → Add**.
2. Type: **Secret**, Name: `GITHUB_TOKEN`, Value: dán token. Bấm **Deploy**.
3. Ở **Settings → Build**, kiểm tra *Deploy command* là `npx wrangler deploy` và *Root directory* để trống hoặc `/`.

Nếu sau này đổi tên repo hay tài khoản GitHub, sửa dòng `GITHUB_REPO` trong `wrangler.jsonc`.

### 3.4 Khoá cửa (đã làm)
Cloudflare Access đang bảo vệ cả link chính và link bản nháp. Danh sách người được vào sửa ở **Zero Trust → Access controls → Applications**.

### 3.5 Nên làm: chuyển repo sang Private
Repo đang **Public**: ai có link GitHub cũng xem được toàn bộ ảnh, dù website đã khoá. Vào **Settings → General → Danger Zone → Change visibility → Private**. Cloudflare vẫn đọc được repo private qua ứng dụng GitHub đã cài.

## 4. Dùng hằng ngày
1. Upload ảnh vào đúng thư mục con trên Drive.
2. Mở website, bấm nút **Refresh** (hai mũi tên vòng tròn, góc trên bên phải).
3. Chờ 2–3 phút. Dòng thông báo ở cuối màn hình cho biết robot đang làm gì. Xong thì trang tự tải lại với ảnh mới.
   Nếu Drive không có gì mới, trang báo "All up to date".

Cũng có thể chạy robot trên GitHub: tab **Actions → Sync gallery → Run workflow**.

## 5. Sau khi tài khoản Drive bị tắt
1. Repo → **Settings → Secrets and variables → Actions → Variables → New variable**: `DRIVE_SYNC_ENABLED` = `false`.
2. Thêm ảnh mới trực tiếp vào `site/media/<tên-sảnh>/` trên GitHub (**Add file → Upload files**). Robot tự làm ảnh thu nhỏ và website tự cập nhật, không cần bấm Refresh.

Tên thư mục sảnh: `logo-mascot`, `desktop-background`, `slide-design`, `mini-games`. Thư mục con bên trong sẽ thành nhóm nhỏ trong sảnh.

## 6. Khi có sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Trang chỉ có nút Home, bấm không đi đâu | Website không thấy `site/data/manifest.json`. Kiểm tra file nằm đúng trong `site/data/` và `wrangler.jsonc` ở thư mục gốc repo. |
| Bấm Refresh báo "isn't switched on yet" | Chưa thêm secret `GITHUB_TOKEN` ở Cloudflare (mục 3.3). |
| Bấm Refresh báo "hit a problem" | Mở GitHub → Actions → lần chạy màu đỏ để xem lỗi. Hay gặp nhất: thư mục Drive chưa chia sẻ cho service account, hoặc token hết hạn. |
| Robot báo dừng vì xoá quá nhiều | Phanh an toàn. Nếu đúng là muốn xoá nhiều ảnh, thêm Variable `ALLOW_MASS_DELETE` = `true`, chạy lại, rồi xoá biến đó. |
| Ảnh mới chưa lên sau 5 phút | Xem Cloudflare → Workers & Pages → bos-asset-museum → Deployments có lỗi không. |
