<template>
  <div>
    <h1>测试</h1>
    <input type="file" @change="handleFileChange" />
    <el-button type="primary" @click="handleUpload">上传</el-button>

    <div>
      <div>计算文件 hash</div>
      <el-progress :percentage="hashProgress"></el-progress>
      <div>总进度</div>
      <el-progress :percentage="uploadPercentage"></el-progress>
      <el-table :data="chunks">
      <el-table-column
        prop="hash"
        label="切片hash"
        align="center"
      ></el-table-column>
      <el-table-column label="大小(KB)" align="center" width="120">
        <template v-slot="{ row }">
          {{ row.size |transformByte}}
        </template>
      </el-table-column>
      <el-table-column label="进度" align="center">
        <template v-slot="{ row }">
          <el-progress
            :percentage="row.progress"
            color="#909399"
          ></el-progress>
        </template>
      </el-table-column>
    </el-table>
    </div>
  </div>
</template>

<script>
import { request } from "./util";
import SparkMd5 from 'spark-md5'
// import axios from 'axios'

// @todo size切分
// @todo canvas方块进度条
// @todo 并发量控制+报错重试
// @todo 上传失败文件碎片的清理工作
// @todo 大文件的hash值计算 （三分+名字+size）或者每10M三分 节省时间 第一块和最后一块取全部，中间的抽样
// @todo 计算哈希 使用time-slice (setTimeout和requestIdleCallback)
// @todo 哈希的计算分级，先计算前面2M和最后一块 中间取样的，如果不同直接上传，想通再计算全部的

// @todo size大小动态调配 根据网速，慢启动


// const request = axios.create({
//   baseURL: 'https://some-domain.com/api/',
// })

const SIZE = 3 * 1024 * 1024;
export default {
  data: () => ({
    container: {
      file: null
    },
    chunks: [],
    hashProgress:0
  }),
  filters: {
    transformByte(val) {
      return Number((val / 1024).toFixed(0));
    }
  },
  computed: {
       uploadPercentage() {
          if (!this.container.file || !this.chunks.length) return 0;
          const loaded = this.chunks
            .map(item => item.size * item.progress)
            .reduce((acc, cur) => acc + cur);
          return parseInt((loaded / this.container.file.size).toFixed(2));
        }
  },

  methods: {
    handleFileChange(e) {
      const [file] = e.target.files;
      if (!file) return;
      this.container.file = file;
    },
    createFileChunk(file, size = SIZE) {
      // 生成文件块
      const chunks = [];
      let cur = 0;
      while (cur < file.size) {
        chunks.push({ file: file.slice(cur, cur + size) });
        cur += size;
      }
      console.log(chunks)
      console.log(chunks.map(v=>v.file))
      return chunks;
    },
    async uploadChunks() {
      const list = this.chunks
        .map(({ chunk, hash, index }, i) => {
          const form = new FormData();
          form.append("chunk", chunk);
          form.append("hash", hash);
          form.append("filename", this.container.file.name);
          return {form,index};
        })
        .map(({form,index}) => request({ 
          url: "http://localhost:3000/upload", 
          data: form,
          onProgress:this.createProgresshandler(this.chunks[index])
        }))
      const ret = await Promise.all(list)
      console.log(ret)
      await this.mergeRequest();
    },
    createProgresshandler(item){
      return e=>{
        console.log(e,item)
        item.progress = parseInt(String((e.loaded / e.total) * 100))
      }
    },
    async mergeRequest() {
      await request({
        url: "http://localhost:3000/merge",
        headers: {
          "content-type": "application/json"
        },
        data: JSON.stringify({
          filename: this.container.file.name,
          size:SIZE
        })
      });
    },
    async calculateHash(chunks){
      return new Promise(resolve=>{
        // web-worker 防止卡顿主线程
        this.container.workder = new Worker('/hash.js')
        this.container.workder.postMessage({chunks})
        this.container.workder.onmessage = e=>{
          const {progress, hash} = e.data
          this.hashProgress = Number(progress.toFixed(2))
          if(hash){
            resolve(hash)
          }
        }
      })
    },
    async handleUpload() {
      if (!this.container.file) return;
      const chunks = this.createFileChunk(this.container.file);

      // 计算哈希
      this.container.hash = await this.calculateHash(chunks)
      this.chunks = chunks.map((chunk, index) => ({
        fileHash: this.container.hash,
        chunk: chunk.file,
        index,
        hash: this.container.file.name + "-" + index,
        progress:0,
        size:chunk.file.size
      }));
      // console.log(this.chunks)
      await this.uploadChunks();
    }
  }
};
</script>