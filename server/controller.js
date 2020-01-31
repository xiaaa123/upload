const path = require('path')
const fse = require("fs-extra")
const multiparty = require("multiparty")
const { resolvePost, pipeStream,extractExt,getUploadedList } = require('./util')

  


class Controller {
  constructor(uploadDir) {
    this.UPLOAD_DIR = uploadDir
  }
  async mergeFileChunk(filePath, fileHash, size){
    // cpmspe/pg)
    const chunkDir = path.resolve(this.UPLOAD_DIR, fileHash)
    const chunkPaths = await fse.readdir(chunkDir)
    // 根据切片下标进行排序
    // 否则直接读取目录的获得的顺序可能会错乱
    chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1])
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
    )
    // fse.rmdirSync(chunkDir) // 合并后删除保存切片的目录
  }


  async handleVerify(req, res) {
    const data = await resolvePost(req)
    const { filename, hash } = data
    const ext = extractExt(filename)
    const filePath = path.resolve(this.UPLOAD_DIR, `${hash}${ext}`)

    // 文件是否存在
    let uploaded = false
    let uploadedList = []
    if (fse.existsSync(filePath)) {
      uploaded = true
    }else{
      // 文件没有完全上传完毕，但是可能存在部分切片上传完毕了
      uploadedList = await getUploadedList(path.resolve(this.UPLOAD_DIR, hash))
    }
    res.end(
      JSON.stringify({
        uploaded,
        uploadedList // 过滤诡异的隐藏文件
      })
    )

  }
  async handleMerge(req, res) {

    const data = await resolvePost(req)
    const {fileHash, filename, size } = data
    const ext = extractExt(filename)
    const filePath = path.resolve(this.UPLOAD_DIR, `${fileHash}${ext}`)
    await this.mergeFileChunk(filePath, fileHash, size)
    res.end(
      JSON.stringify({
        code: 0,
        message: "file merged success"
      })
    )

  
  }
  async handleUpload(req, res) {
    const multipart = new multiparty.Form()
    multipart.parse(req, async (err, field, file) => {
      if (err) {
        console.log(err)
        return
      }
      const [chunk] = file.chunk
      const [hash] = field.hash
      const [filename] = field.filename
      const [fileHash] = field.fileHash
      const filePath = path.resolve(
        this.UPLOAD_DIR,
        `${fileHash}${extractExt(filename)}`
      )
      const chunkDir = path.resolve(this.UPLOAD_DIR, fileHash)


      // 文件存在直接返回
      if (fse.existsSync(filePath)) {
        res.end("file exist")
        return
      }

      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir)
      }
      await fse.move(chunk.path, `${chunkDir}/${hash}`)
      res.end("received file chunk")
    })
  }
}


module.exports = Controller