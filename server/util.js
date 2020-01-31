const fse = require("fs-extra")
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

exports.pipeStream = (filePath, writeStream) =>
  new Promise(resolve => {
    const readStream = fse.createReadStream(filePath)
    readStream.on("end", () => {
      fse.unlinkSync(filePath)
      resolve()
    })
    readStream.pipe(writeStream)
  })

  // 返回已经上传切片名列表

exports.getUploadedList = async (dirPath)=>{
    return fse.existsSync(dirPath) 
      ? (await fse.readdir(dirPath)).filter(name=>name[0]!=='.') // 过滤诡异的隐藏文件
      : []
  }
exports.extractExt = filename => filename.slice(filename.lastIndexOf("."), filename.length)
