<template>
  <div>
    <div>
      <input type="text" value="测试页面是否卡顿" />
    </div>
    <h1>测试</h1>
    <input type="file" @change="handleFileChange" />
    <!-- <el-button type="primary" @click="handleUpload" :disabled="uploadDisabled">上传</el-button> -->
    <el-button type="primary" @click="handleUpload">上传</el-button>
    <el-button @click="handleResume" v-if="status === Status.pause">恢复</el-button>
    <el-button
      v-else
      :disabled="status !== Status.uploading || !container.hash"
      @click="handlePause"
    >暂停</el-button>
    <div>
      <div>计算文件 hash</div>
      <el-progress :percentage="hashProgress"></el-progress>
      <div>总进度</div>
      <el-progress :percentage="fakeProgress"></el-progress>

      <el-table :data="chunks">
        <el-table-column prop="hash" label="切片hash" align="center"></el-table-column>
        <el-table-column label="大小(KB)" align="center" width="120">
          <template v-slot="{ row }">{{ row.size |transformByte}}</template>
        </el-table-column>
        <el-table-column label="进度" align="center">
          <template v-slot="{ row }">
            <el-progress :percentage="row.progress"></el-progress>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { request, post } from "./util"
import SparkMD5 from "spark-md5"

// import axios from 'axios'

// 1. hash切片( 介绍一下generator，，我们录制以下即可)
// 2. hash计算切片，requestIdleCallback
// 3. hash计算方式取巧 先计算前面2M和最后一块 中间取样的  命中率低 但是效率高 考虑两者配合 (布隆过滤器)
// 4. 上传并发量控制， 我的mac上4个G计算hash40秒，虽然web-workder导致不卡顿了，但是建立这么多TCP链接，依然会卡死
// 并发控制这个，我记得也是个头条面试题
// 5. 并发中上传失败重试次数 + 错误提醒 （恢复）
// 6. 方块进度条（canvas or div）
// 7. 上传失败文件定时清理
// 8. size动态调配，根据网速 慢启动的逻辑， 思考这种情况方块进度条怎么做
// 9. 文件页面提醒小tips 根据status
// 10 大文件下载 http分片，ftp协议的node实现（ftp介绍逻辑 不实现）
// 11 思考

// const request = axios.create({
//   baseURL: 'https://some-domain.com/api/',
// })

const SIZE = 2 * 1024 * 1024
const Status = {
  wait: "wait",
  pause: "pause",
  uploading: "uploading"
}
export default {
  data: () => ({
    container: {
      file: null
    },
    chunks: [],
    hashProgress: 0,
    // 请求列表，方便随时abort
    requestList: [],
    Status,
    // 默认状态
    status: Status.wait,
    fakeProgress: 0
  }),
  filters: {
    transformByte(val) {
      return Number((val / 1024).toFixed(0))
    }
  },
  computed: {
    uploadDisabled() {
      return (
        !this.container.file ||
        [Status.pause, Status.uploading].includes(this.status)
      )
    },
    uploadProgress() {
      if (!this.container.file || !this.chunks.length) return 0
      const loaded = this.chunks
        .map(item => item.size * item.progress)
        .reduce((acc, cur) => acc + cur)
      return parseInt((loaded / this.container.file.size).toFixed(2))
    }
  },
  watch: {
    uploadProgress(now) {
      if (now > this.fakeProgress) {
        this.fakeProgress = now
      }
    }
  },

  methods: {
    async handleResume() {
      this.status = Status.uploading

      const { uploadedList } = await this.verify(
        this.container.file.name,
        this.container.hash
      )
      await this.uploadChunks(uploadedList)
    },
    handlePause() {
      this.status = Status.pause

      this.requestList.forEach(xhr => xhr?.abort())
      this.requestList = []
    },
    handleFileChange(e) {
      const [file] = e.target.files
      if (!file) return
      this.container.file = file
    },
    createFileChunk(file, size = SIZE) {
      // 生成文件块
      const chunks = []
      let cur = 0
      while (cur < file.size) {
        chunks.push({ file: file.slice(cur, cur + size) })
        cur += size
      }
      return chunks
    },
    async uploadChunks(uploadedList = []) {
      console.log(this.chunks)
      const list = this.chunks
        .filter(chunk => uploadedList.indexOf(chunk.hash) == -1)
        .map(({ chunk, hash, index }, i) => {
          const form = new FormData()
          form.append("chunk", chunk)
          form.append("hash", hash)
          form.append("filename", this.container.file.name)
          form.append("fileHash", this.container.hash)
          return { form, index }
        })
        .map(({ form, index }) =>
          request({
            url: "/upload",
            data: form,
            onProgress: this.createProgresshandler(this.chunks[index]),
            requestList: this.requestList
          })
        )
      const ret = await Promise.all(list)
      if (uploadedList.length + list.length === this.chunks.length) {
        // 上传和已经存在之和 等于全部的再合并
        await this.mergeRequest()
      }
    },
    createProgresshandler(item) {
      return e => {
        item.progress = parseInt(String((e.loaded / e.total) * 100))
      }
    },

    async mergeRequest() {
      await post("/merge", {
        filename: this.container.file.name,
        size: SIZE,
        fileHash: this.container.hash
      })
      // await request({
      //   url: "/merge",
      //   headers: {
      //     "content-type": "application/json"
      //   },
      //   data: JSON.stringify({
      //     filename: this.container.file.name,
      //     size:SIZE
      //   })
      // })
    },
    async calculateHash(chunks) {
      return new Promise(resolve => {
        // web-worker 防止卡顿主线程
        this.container.workder = new Worker("/hash.js")
        this.container.workder.postMessage({ chunks })
        this.container.workder.onmessage = e => {
          const { progress, hash } = e.data
          this.hashProgress = Number(progress.toFixed(2))
          if (hash) {
            resolve(hash)
          }
        }
      })
    },
    async calculateHashSample(){
      return new Promise(resolve=>{
        const spark = new SparkMD5.ArrayBuffer()
        const reader = new FileReader()
        const file = this.container.file
        // 文件大小
        const size = this.container.file.size
        let offset = 2*1024*1024

        let chunks = [file.slice(0,offset)]

        // 前面100K

        let cur = offset
        while (cur < size) {
          // 最后一块全部加进来
          if(cur+offset>=size){
            chunks.push(file.slice(cur, cur+offset) )
          }else{
            // 中间的 前中后去两个子杰
            const mid = cur+offset/2
            const end = cur+offset
            chunks.push(file.slice(cur,cur+2))
            chunks.push(file.slice(mid,mid+2))
            chunks.push(file.slice(end-2,end))
          }
          // 前取两个子杰
          cur += offset
        }
        // 拼接
        reader.readAsArrayBuffer(new Blob(chunks))

        // 最后100K
        reader.onload = e=>{
          spark.append(e.target.result)
          
          resolve(spark.end())
        }

      })

    },
    async calculateHashIdle(chunks) {
      return new Promise(resolve => {
        const spark = new SparkMD5.ArrayBuffer()
        let count = 0
        const appendToSpark = async ( file)=>{
          return new Promise(resolve => {

            const reader = new FileReader()
            reader.readAsArrayBuffer(file)
            reader.onload = e => {
              spark.append(e.target.result)
              resolve()
            }
          })
        }
        const workLoop = async (deadline)=>{
          // 有任务，并且当前帧还没结束
          while(count<chunks.length &&deadline.timeRemaining() > 1 ){
            await appendToSpark(chunks[count].file)
            count++
            // 没有了 计算完毕
            if (count<chunks.length) {
              // 计算中
              this.hashProgress = Number((100*count / chunks.length).toFixed(2))
              // console.log(this.hashProgress)
            } else {
              // 计算完毕
              this.hashProgress = 100
              resolve(spark.end())
            }
          }
          window.requestIdleCallback(workLoop)
        }
        window.requestIdleCallback(workLoop)
      })
    },
    async calculateHashSync(chunks) {
      return new Promise(resolve => {
        const spark = new SparkMD5.ArrayBuffer()
        let progress = 0
        let count = 0

        const loadNext = index => {
          const reader = new FileReader()
          reader.readAsArrayBuffer(chunks[index].file)
          reader.onload = e => {
            // 累加器 不能依赖index，
            count++
            // 增量计算md5
            spark.append(e.target.result)
            if (count === chunks.length) {
              // 通知主线程，计算结束
              resolve(spark.end())
              this.hashProgress = 100
            } else {
              // 每个区块计算结束，通知进度即可
              this.hashProgress += 100 / chunks.length

              // 计算下一个
              loadNext(count)
            }
          }
        }
        // 启动
        loadNext(0)
      })
      // 不计算之前的 方便一会拆解
    },
    async verify(filename, hash) {
      const data = await post("/verify", { filename, hash })
      return data
    },
    async handleUpload() {
      if (!this.container.file) return
      this.status = Status.uploading
      const chunks = this.createFileChunk(this.container.file)
      console.log(chunks)
      // 计算哈希
      // this.container.hash = await this.calculateHashSync(chunks)
      console.time('samplehash')
      // 这样抽样，大概1个G1秒，如果还嫌慢，可以考虑分片+web-worker的方式
      // 这种方式偶尔会误判 不过大题效率不错
      // 可以考虑和全部的hash配合，因为samplehash不存在，就一定不存在，存在才有可能误判，有点像布隆过滤器
      this.container.hash = await this.calculateHashSample()
      console.timeEnd('samplehash')
      
      console.log('hashSample',this.container.hash)

      this.container.hash = await this.calculateHashIdle(chunks)
      console.log('hash2',this.container.hash)

      this.container.hash = await this.calculateHash(chunks)
      console.log('hash3',this.container.hash)



      // 判断文件是否存在,如果不存在，获取已经上传的切片
      const { uploaded, uploadedList } = await this.verify(
        this.container.file.name,
        this.container.hash
      )

      if (uploaded) {
        return this.$message.success("秒传:上传成功")
      }
      this.chunks = chunks.map((chunk, index) => {
        const chunkName = this.container.hash + "-" + index
        return {
          fileHash: this.container.hash,
          chunk: chunk.file,
          index,
          hash: chunkName,
          progress: uploadedList.indexOf(chunkName) > -1 ? 100 : 0,
          size: chunk.file.size
        }
      })

      return 

      // 传入已经存在的切片清单
      await this.uploadChunks(uploadedList)
    }
  }
}
</script>