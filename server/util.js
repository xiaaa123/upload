const fse = require("fs-extra")
const path = require('path')

exports.resolvePost = req =>
  new Promise(resolve => {
    let chunk = ""
    req.on("data", data => {
      chunk += data
    })
    req.on("end", () => {
      resolve(JSON.parse(chunk))
    })
  })

const pipeStream = (filePath, writeStream) =>
  new Promise(resolve => {
    const readStream = fse.createReadStream(filePath)
    readStream.on("end", () => {
      fse.unlinkSync(filePath)
      resolve()
    })
    readStream.pipe(writeStream)
  })
exports.mergeFiles = async (chunkPaths,filePath,size)=>{
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        chunkPath,
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

}


  // 返回已经上传切片名列表

exports.getUploadedList = async (dirPath)=>{
    return fse.existsSync(dirPath) 
      ? (await fse.readdir(dirPath)).filter(name=>name[0]!=='.') // 过滤诡异的隐藏文件
      : []
  }
exports.extractExt = filename => filename.slice(filename.lastIndexOf("."), filename.length)
