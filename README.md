# Battleships

Battleships là game bắn tàu viết bằng `HTML`, `CSS`, `JavaScript`, chạy với `Express` và `Socket.IO`.

Project hiện có:
- `Single Player` với AI 3 cấp độ
- `Multiplayer` theo phòng riêng
- menu cấu hình thời gian lượt chơi và thời gian trận
- giao diện tách riêng theo từng trang
- hỗ trợ chạy bằng `Node.js` hoặc `Docker`

## Cấu Trúc

```text
battleships-master/
├── public/
│   ├── assets/
│   │   ├── images/
│   │   ├── js/
│   │   │   ├── ai/
│   │   │   ├── menu/
│   │   │   ├── setup/
│   │   │   └── shared/
│   │   └── styles/
│   ├── index.html
│   ├── menu.html
│   ├── singleplayer.html
│   └── multiplayer.html
├── server.js
├── package.json
├── package-lock.json
└── Dockerfile
```

## Yêu Cầu

- `Node.js` 18 trở lên
- `npm`

## Cài Đặt

```bash
npm install
```

## Chạy Local

Khởi động server:

```bash
npm start
```

Server mặc định chạy ở cổng `5500`.

Mở trình duyệt:

- `http://localhost:5500`

## Chế Độ Chơi

### Single Player

- vào `Single Player`
- chọn độ khó AI
- chọn `Turn Time`
- chọn `Match Time`
- vào game và đặt tàu

### Multiplayer

- vào `Multiplayer`
- cấu hình thời gian
- tạo phòng hoặc nhập mã phòng
- chia sẻ mã phòng cho người chơi thứ hai
- cả hai đặt tàu rồi bắt đầu trận

## Lưu Ý Multiplayer

- Multiplayer chỉ hoạt động khi chạy qua `server.js`
- không mở `multiplayer.html` bằng Live Server nếu không có backend `Socket.IO`
- đường dẫn đúng là:

```text
http://localhost:5500/multiplayer.html
```

## Docker

Build image:

```bash
docker build -t battleships .
```

Chạy container:

```bash
docker run -p 5500:5500 battleships
```

Sau đó mở:

- `http://localhost:5500`

## Ghi Chú Deploy

- `Single Player` có thể deploy như web app bình thường
- `Multiplayer` cần server realtime vì đang dùng `Socket.IO`
- nếu deploy lên nền tảng không hỗ trợ WebSocket server trực tiếp, bạn cần tách backend realtime riêng

## Script

```bash
npm start
```

## Công Nghệ Sử Dụng

- `HTML`
- `CSS`
- `JavaScript`
- `Express`
- `Socket.IO`

