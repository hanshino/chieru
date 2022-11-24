# chieru

這個專案目的在於提供公主連結圖檔，並且提供給其他專案使用。

## 動機

在 2022/11/23 時，發現 [蘭德索爾圖書館](https://pcredivewiki.tw/) 的圖檔阻擋了 **非透過自家網站瀏覽圖片的來源**。

因此建立此專案，提供自己的其他專案存取公主連結的相關圖檔。

## 原理
透過優先存取本地圖檔，如沒有的情況則取用 [干炸里脊资源](https://redive.estertion.win/) 的資源，並且保存到本地進行緩存。

## 開發環境

| 軟體       | 版本    |
| ---------- | ------- |
| Node.js    | 18.12.1 |
| TypeScript | 4.9.3   |
| npm        | 9.1.2   |
| yarn       | 1.22.19 |

## 啟用方式

### Docker

```bash
docker build -t chieru .
docker run -d -p 3000:3000 chieru
```

### Node.js

```bash
yarn install
yarn build
yarn start
```

### Docker Compose

```bash
docker-compose up -d
```