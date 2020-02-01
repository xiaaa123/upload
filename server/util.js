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
      // 删除文件
      fse.unlinkSync(filePath)
      resolve()
    })
    readStream.pipe(writeStream)
  })
exports.mergeFiles = async (files,dest,size)=>{
  await Promise.all(
    files.map((file, index) =>
      pipeStream(
        file,
        // 指定位置创建可写流 加一个put避免文件夹和文件重名
        // hash后不存在这个问题，因为文件夹没有后缀
        // fse.createWriteStream(path.resolve(dest, '../', 'out' + filename), {
        fse.createWriteStream(dest, {
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



const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))



class Task{
  constructor(){

  }
/**
 * 
 * @param {异步任务列表} tasks 
 * @param {并发数} limit 
 * @param {出错重试次数} retry 
 */
  parallel(tasks,limit=4){
    // let 
  }
}

// async function test(){
//   let t = new Task()
//   const ret = await t.parallel([1,3,1.5,2,4],3)
//   console.log('ret',ret)
// }
// test()



