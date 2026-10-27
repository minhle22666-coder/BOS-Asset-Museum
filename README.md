# 🍀 BOS Asset Museum

Website "bảo tàng online" chứa toàn bộ logo, mascot, hình nền và vật liệu mini game của team BOS.
Mỗi ảnh có nút **Copy** (dán thẳng vào Google Slides / PowerPoint) và **Download**; mỗi khu có nút tải cả khu dạng ZIP, và có nút **Download all** gói tất cả.

---

## 1. Hệ thống chạy thế nào (giải thích đời thường)

```
Google Drive (thư mục BOS-Asset)      ← bạn upload ảnh ở đây như bình thường
        │   mỗi giờ, "robot" GitHub ghé qua lấy ảnh mới
        ▼
GitHub repo (kho lưu trữ chính)       ← BẢN SAO VĨNH VIỄN của mọi ảnh
        │   mỗi khi kho thay đổi
        ▼
Cloudflare Pages (website)            ← nơi đồng nghiệp vào xem
        │
Cloudflare Access (bảo vệ cửa)        ← bắt đăng nhập Google, chỉ cho bos@kamereo.vn vào
```

Ví von: **Drive là cái hộp thư**, **GitHub là cái kho**, **website là phòng trưng bày**.
Robot mỗi giờ mở hộp thư, mang ảnh mới vào kho, rồi phòng trưng bày tự cập nhật.
Tháng 1 hộp thư bị khoá (account bạn deactivate) cũng không sao: ảnh **đã nằm trong kho rồi**, phòng trưng bày vẫn mở bình thường.

Robot còn có "phanh an toàn": nếu đột nhiên không đọc được Drive, hoặc Drive trống trơn bất thường, nó **dừng lại, không xoá gì cả**.

### Vì sao không dùng GitHub Pages trực tiếp?
GitHub Pages bản miễn phí **luôn công khai** — có link ảnh là ai cũng mở được, nút "Login Google" trên trang chỉ là cánh cửa vẽ trên tường.
Cloudflare Access thì kiểm tra tài khoản **trước khi** đưa ra bất kỳ file nào → bảo mật thật. Miễn phí tới 50 người dùng.

(Nếu vẫn muốn dùng GitHub Pages, đổi `authMode` trong `site/config.js` thành `"google-signin"` — nhưng hiểu rằng đó chỉ là lớp che, không phải khoá.)

---

## 2. ⚠️ Điều quan trọng nhất: tất cả phải đứng tên `bos@kamereo.vn`

Tài khoản `tuyen.mai@kamereo.vn` sẽ bị tắt vào tháng 1. Bất cứ thứ gì đứng tên tài khoản đó sẽ "chết" theo.
Vì vậy, **đăng nhập bằng `bos@kamereo.vn`** khi tạo cả 3 thứ sau:

| Thứ cần tạo | Dùng để làm gì |
|---|---|
| Tài khoản GitHub (đăng ký bằng email bos@kamereo.vn) | Giữ kho ảnh |
| Google Cloud project | Cho robot quyền đọc Drive |
| Tài khoản Cloudflare | Chạy website + khoá cửa |

---

## 3. Cài đặt từng bước (~45 phút, làm một lần)

### Bước 1 — Đưa code lên GitHub
1. Đăng nhập GitHub bằng tài khoản của `bos@kamereo.vn` → **New repository** → tên `bos-asset-museum` → chọn **Private** → Create.
2. Trên trang repo mới, bấm **uploading an existing file**, kéo thả **toàn bộ nội dung** của thư mục này (kể cả thư mục `.github` — nếu trình duyệt ẩn nó, dùng GitHub Desktop) → **Commit changes**.

### Bước 2 — Tạo "chìa khoá" cho robot đọc Drive (Google Cloud)
Ví von: tạo một "nhân viên ảo" (service account) chỉ có quyền **xem** thư mục ảnh.

1. Vào <https://console.cloud.google.com> bằng `bos@kamereo.vn` → tạo project mới, ví dụ `bos-asset-museum`.
2. Menu **APIs & Services → Library** → tìm **Google Drive API** → **Enable**.
3. Menu **IAM & Admin → Service Accounts** → **Create service account** → tên `gallery-sync` → Done.
   Bấm vào nó, copy email dạng `gallery-sync@bos-asset-museum.iam.gserviceaccount.com`.
4. Tab **Keys → Add key → Create new key → JSON** → máy tải về 1 file `.json`. Giữ kín file này.
   > Nếu báo lỗi *"Key creation is disabled"*: công ty đang chặn tạo key. Nhờ admin Google Workspace mở, hoặc dùng cách không cần key ở **Phụ lục A**.
5. Mở Google Drive, chuột phải thư mục **🍀BOS-Asset** → **Share** → dán email service account ở trên → quyền **Viewer** → Send.

### Bước 3 — Cất chìa khoá vào GitHub
Trong repo GitHub: **Settings → Secrets and variables → Actions → New repository secret**, tạo 2 secret:

| Name | Value |
|---|---|
| `GDRIVE_ROOT_FOLDER_ID` | `1CIMqvWYmjFwP58slQI0XLhG8eVGVgdm7` |
| `GDRIVE_SA_KEY` | mở file `.json` ở bước 2 bằng Notepad, copy **toàn bộ** nội dung dán vào |

Sau đó vào tab **Actions** → chọn **Sync gallery** → **Run workflow**.
Khoảng 1–2 phút, nút xanh ✅ là xong. Mở thư mục `site/media/` trong repo sẽ thấy ảnh đã về.

### Bước 4 — Dựng website (Cloudflare Pages)
1. Đăng ký <https://dash.cloudflare.com> bằng `bos@kamereo.vn` (gói Free).
2. **Workers & Pages → Create → Pages → Connect to Git** → kết nối GitHub → chọn repo `bos-asset-museum`.
3. Cấu hình build:
   - Framework preset: **None**
   - Build command: *(để trống)*
   - Build output directory: **`site`**
4. **Save and Deploy**. Bạn nhận được link dạng `https://bos-asset-museum.pages.dev`.

Từ giờ mỗi khi robot thêm ảnh vào GitHub, Cloudflare tự đăng bản mới trong ~1 phút.

### Bước 5 — Khoá cửa bằng đăng nhập Google (Cloudflare Access)
1. Trong Cloudflare, mở **Zero Trust** → đặt tên team (ví dụ `kamereo-bos`) → chọn gói **Free**.
2. **Settings → Authentication → Login methods → Add new → Google**.
   Làm theo hướng dẫn trên màn hình: tạo **OAuth Client ID** trong Google Cloud project ở bước 2
   (Authorized redirect URI = `https://kamereo-bos.cloudflareaccess.com/cdn-cgi/access/callback`), dán Client ID + Secret vào Cloudflare.
   > Muốn đơn giản hơn: dùng **One-time PIN** (Cloudflare gửi mã 6 số về email) — không cần bước OAuth.
3. **Access → Applications → Add an application → Self-hosted**:
   - Application domain: `bos-asset-museum.pages.dev`
   - Thêm domain thứ 2: `*.bos-asset-museum.pages.dev` (khoá luôn các link bản nháp)
   - Policy: **Allow** → Include → **Emails** → `bos@kamereo.vn`
     (muốn cho cả công ty: chọn **Emails ending in** → `@kamereo.vn`)
4. Save. Mở link website ở tab ẩn danh → phải thấy trang đăng nhập của Cloudflare → đăng nhập `bos@kamereo.vn` → vào được bảo tàng. ✅

---

## 4. Dùng hằng ngày

- **Thêm ảnh (tới tháng 12):** upload vào đúng thư mục con trong Drive như bình thường. Tối đa ~1 giờ sau sẽ lên web.
  Muốn lên ngay: GitHub → Actions → Sync gallery → Run workflow.
- **Thư mục con trong Drive** (ví dụ `Avatar-Head-For-Quiz`) tự thành một nhóm riêng trên web.
- **Đổi tên/xoá ảnh trong Drive** → web cũng đổi/xoá theo.
- **Tạo thư mục mới ngang hàng 4 thư mục hiện có** → web tự tạo khu mới. Muốn đặt tên đẹp/mô tả: sửa `scripts/categories.json`.
- File **trên 25 MB** sẽ bị bỏ qua (giới hạn của Cloudflare) — xuất bản nhẹ hơn rồi upload lại.

---

## 5. Checklist trước khi account bị tắt (tháng 12)

- [ ] Upload xong ảnh lên Drive → chạy **Run workflow** lần cuối → kiểm tra website đủ ảnh.
- [ ] Kiểm tra GitHub, Google Cloud, Cloudflare đều đứng tên `bos@kamereo.vn` (không phải `tuyen.mai`).
- [ ] Chọn 1 trong 2:
  - **Muốn team tiếp tục upload qua Drive:** chuyển thư mục BOS-Asset sang `bos@kamereo.vn`
    (Share → chọn bos@ → **Transfer ownership**; nhớ làm cho cả các file bên trong, hoặc nhờ admin chuyển dữ liệu khi xoá account),
    hoặc chuyển thư mục vào một **Shared drive** của công ty. Service account vẫn phải có quyền Viewer.
    Nếu ID thư mục thay đổi, cập nhật lại secret `GDRIVE_ROOT_FOLDER_ID`.
  - **Không cần Drive nữa:** GitHub → Settings → Secrets and variables → Actions → tab **Variables** → tạo `DRIVE_SYNC_ENABLED` = `false`.
    Từ đó thêm ảnh trực tiếp trên GitHub (mục 6).
- [ ] Bàn giao link website + tài khoản `bos@kamereo.vn` cho người phụ trách.

## 6. Sau khi Drive không còn: thêm ảnh trực tiếp trên GitHub
1. Repo → vào `site/media/<tên-khu>/` (ví dụ `site/media/slide-design/`).
2. **Add file → Upload files** → kéo ảnh vào (muốn tạo nhóm con: gõ `Ten-Nhom/` trước tên file khi tạo, hoặc upload cả thư mục) → **Commit changes**.
3. Robot tự tạo ảnh xem trước + cập nhật web trong ~2 phút.

Tên thư mục các khu: `logo-mascot`, `desktop-background`, `slide-design`, `mini-games`.

---

## 7. Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| Actions báo đỏ ❌ ở bước "Mirror Google Drive" | Kiểm tra lại 2 secret; thư mục đã share cho email service account chưa |
| Log ghi *"Cannot reach Google Drive"* | Robot không đọc được Drive → nó giữ nguyên ảnh cũ. Bình thường sau khi tắt Drive; đặt `DRIVE_SYNC_ENABLED=false` để ẩn cảnh báo |
| Log ghi *"Aborting with no changes"* | Phanh an toàn: Drive mất >30% ảnh cùng lúc. Nếu bạn thật sự muốn xoá hàng loạt: tạo Variable `ALLOW_MASS_DELETE` = `true`, chạy lại, rồi xoá variable đó |
| Nút Copy không chạy | Trình duyệt cũ/Firefox cũ không hỗ trợ copy ảnh → dùng Download. Chrome, Edge, Safari đều chạy |
| Web hiện "Nothing here yet" | Robot chưa chạy lần nào, hoặc thư mục Drive đó đang trống |

## 8. Chi phí
Tất cả **0 đồng** với quy mô hiện tại: GitHub Actions (2.000 phút/tháng cho repo private, robot dùng khoảng 700–900 phút), Cloudflare Pages + Access gói Free.
Muốn tiết kiệm phút GitHub: sửa `cron` trong `.github/workflows/sync.yml` thành `"17 */3 * * *"` (3 giờ chạy một lần).

---

## Phụ lục A — Không tạo được key JSON (Workload Identity Federation)
Cách này cho GitHub "xác minh danh tính" với Google mà không cần file key.
1. Google Cloud → **IAM → Workload Identity Federation** → tạo Pool + Provider loại **OIDC**, issuer `https://token.actions.githubusercontent.com`,
   attribute mapping `google.subject=assertion.sub, attribute.repository=assertion.repository`, condition `assertion.repository=='<github-user>/bos-asset-museum'`.
2. Cấp cho principal của repo quyền **Workload Identity User** trên service account `gallery-sync`.
3. GitHub → Variables: `GCP_WIF_PROVIDER` = `projects/<số>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`, `GCP_SERVICE_ACCOUNT` = email service account. Xoá secret `GDRIVE_SA_KEY`.

## Phụ lục B — Cấu trúc thư mục
```
.github/workflows/sync.yml   robot chạy mỗi giờ
scripts/sync_drive.py        copy Drive → site/media (có phanh an toàn)
scripts/build_manifest.py    tạo ảnh xem trước + danh sách ảnh cho web
scripts/categories.json      tên, mô tả, thứ tự 4 khu
site/                        toàn bộ website (Cloudflare đăng thư mục này)
  config.js                  cài đặt đăng nhập
  media/                     ảnh gốc (robot tự tạo)
  thumbs/                    ảnh xem trước (robot tự tạo)
  data/manifest.json         danh sách ảnh (robot tự tạo)
.sync/drive_state.json       sổ ghi nhớ của robot (file nào đến từ Drive)
```
Xem thử trên máy: mở terminal trong thư mục `site`, chạy `python -m http.server`, vào <http://localhost:8000> (đặt `authMode: "none"` trong `config.js` khi thử).
