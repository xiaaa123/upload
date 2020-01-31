const http = require("http")
const path = require('path')
const fse = require("fs-extra")
const multiparty = require("multiparty")
const { resolvePost, pipeStream } = require('./util')
const server = http.createServer()
const UPLOAD_DIR = path.resolve(__dirname, "..", "target"); // 大文件存储目录



const mergeFileChunk = async (filePath, fileHash, size) => {
  // cpmsp;e/;pg)
  const chunkDir = path.resolve(UPLOAD_DIR, fileHash);
  const chunkPaths = await fse.readdir(chunkDir);
  // 根据切片下标进行排序
  // 否则直接读取目录的获得的顺序可能会错乱
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
  console.log(chunkPaths)
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 指定位置创建可写流 加一个put避免文件夹和文件重名
        // hash后不存在这个问题，因为文件夹没有后缀
        // fse.createWriteStream(path.resolve(filePath, '../', 'out' + filename), {
        fse.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size
        })
      )
    )
  );
  // fse.rmdirSync(chunkDir); // 合并后删除保存切片的目录
};

const extractExt = filename => filename.slice(filename.lastIndexOf("."), filename.length)
server.on("request", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "*")
  if (req.method === "OPTIONS") {
    res.status = 200
    res.end()
    return
  }
  console.log(req.method, req.url)
  if (req.method === "POST") {
    if (req.url == '/upload') {
      const multipart = new multiparty.Form()
      multipart.parse(req, async (err, field, file) => {

        if (err) {
          console.log(err)
          return
        }
        console.log(field)
        const [chunk] = file.chunk
        const [hash] = field.hash
        const [filename] = field.filename
        const [fileHash] = field.fileHash
        const filePath = path.resolve(
          UPLOAD_DIR,
          `${fileHash}${extractExt(filename)}`
        );
        const chunkDir = path.resolve(UPLOAD_DIR, fileHash);


      // 文件存在直接返回
      if (fse.existsSync(filePath)) {
        res.end("file exist");
        return;
      }

        if (!fse.existsSync(chunkDir)) {
          await fse.mkdirs(chunkDir)
        }
        await fse.move(chunk.path, `${chunkDir}/${hash}`)
        res.end("received file chunk");
      })
    }
    if (req.url == '/merge') {
      const data = await resolvePost(req);
      const {fileHash, filename, size } = data;
      const ext = extractExt(filename)


      const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
      await mergeFileChunk(filePath, fileHash, size);
      res.end(
        JSON.stringify({
          code: 0,
          message: "file merged success"
        })
      );

    }
    if (req.url == '/verify') {
      const data = await resolvePost(req);
      const { filename, hash } = data
      const ext = extractExt(filename)
      const filePath = path.resolve(UPLOAD_DIR, `${hash}${ext}`)

      // 文件是否存在
      let uploaded = false
      if (fse.existsSync(filePath)) {
        uploaded = true
      }
      res.end(
        JSON.stringify({
          uploaded
        })
      );

    }
  }

})

server.listen(3000, () => console.log("正在监听 3000 端口"))
