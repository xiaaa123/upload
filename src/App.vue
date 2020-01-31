<template>
  <div>
    <h1>测试</h1>
    <input type="file" @change="handleFileChange" />
    <el-button type="primary" @click="handleUpload" :disabled="uploadDisabled">上传</el-button>
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
import { request, post } from "./util";
import SparkMd5 from "spark-md5";
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
const Status = {
  wait: "wait",
  pause: "pause",
  uploading: "uploading"
};
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
    fakeProgress:0
  }),
  filters: {
    transformByte(val) {
      return Number((val / 1024).toFixed(0));
    }
  },
  computed: {
    uploadDisabled() {
      return (
        !this.container.file ||
        [Status.pause, Status.uploading].includes(this.status)
      );
    },
    uploadProgress() {
      if (!this.container.file || !this.chunks.length) return 0;
      const loaded = this.chunks
        .map(item => item.size * item.progress)
        .reduce((acc, cur) => acc + cur);
      return parseInt((loaded / this.container.file.size).toFixed(2));
    }
  },
  watch:{
    uploadProgress(now){
      if(now>this.fakeProgress){
        this.fakeProgress =now
      }
    }
  },

  methods: {
    async handleResume() {
      this.status = Status.uploading

      const { uploadedList } = await this.verify(
        this.container.file.name,
        this.container.hash
      );
      await this.uploadChunks(uploadedList);
    },
    handlePause() {
      this.status = Status.pause

      this.requestList.forEach(xhr => xhr?.abort());
      this.requestList = [];
    },
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
      return chunks;
    },
    async uploadChunks(uploadedList) {
      console.log(this.chunks);
      const list = this.chunks
        .filter(chunk => uploadedList.indexOf(chunk.hash) == -1)
        .map(({ chunk, hash, index }, i) => {
          const form = new FormData();
          form.append("chunk", chunk);
          form.append("hash", hash);
          form.append("filename", this.container.file.name);
          form.append("fileHash", this.container.hash);
          return { form, index };
        })
        .map(({ form, index }) =>
          request({
            url: "/upload",
            data: form,
            onProgress: this.createProgresshandler(this.chunks[index]),
            requestList: this.requestList
          })
        );
      const ret = await Promise.all(list);
      if (uploadedList.length + list.length === this.chunks.length) {
        // 上传和已经存在之和 等于全部的再合并
        await this.mergeRequest();
      }
    },
    createProgresshandler(item) {
      return e => {
        item.progress = parseInt(String((e.loaded / e.total) * 100));
      };
    },

    async mergeRequest() {
      await post("/merge", {
        filename: this.container.file.name,
        size: SIZE,
        fileHash: this.container.hash
      });
      // await request({
      //   url: "/merge",
      //   headers: {
      //     "content-type": "application/json"
      //   },
      //   data: JSON.stringify({
      //     filename: this.container.file.name,
      //     size:SIZE
      //   })
      // });
    },
    async calculateHash(chunks) {
      return new Promise(resolve => {
        // web-worker 防止卡顿主线程
        this.container.workder = new Worker("/hash.js");
        this.container.workder.postMessage({ chunks });
        this.container.workder.onmessage = e => {
          const { progress, hash } = e.data;
          this.hashProgress = Number(progress.toFixed(2));
          if (hash) {
            resolve(hash);
          }
        };
      });
    },
    async verify(filename, hash) {
      const data = await post("/verify", { filename, hash });
      return data;
    },
    async handleUpload() {
      if (!this.container.file) return;
      this.status = Status.uploading;
      const chunks = this.createFileChunk(this.container.file);

      // 计算哈希
      this.container.hash = await this.calculateHash(chunks);

      // 判断文件是否存在,如果不存在，获取已经上传的切片
      const { uploaded, uploadedList } = await this.verify(
        this.container.file.name,
        this.container.hash
      );

      if (uploaded) {
        return this.$message.success("秒传:上传成功");
      }
      this.chunks = chunks.map((chunk, index) => {
        const chunkName = this.container.hash + "-" + index
        return       {
          fileHash: this.container.hash,
          chunk: chunk.file,
          index,
          hash: chunkName,
          progress: uploadedList.indexOf(chunkName)>-1?100:0,
          size: chunk.file.size
        }
      }
      

      );
      console.log(this.chunks)
      // console.log(this.chunks)
      // 传入已经存在的切片清单
      await this.uploadChunks(uploadedList);
    }
  }
};
</script>