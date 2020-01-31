<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <el-button type="primary" @click="handleUpload">上传</el-button>

    <div>
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
import axios from 'axios'
// ~@todo axios发送请求  
// @todo canvas方块进度条
// @todo 并发量控制+报错重试
// @todo 上传失败文件碎片的清理工作（垃圾文件每天清理）
// @todo 大文件的hash值计算 （三分+名字+size）或者每10M三分 节省时间 第一块和最后一块
// @todo 计算哈希 使用time-slice
const $axios = axios.create({
  baseURL: 'http://localhost:3000',
})

const SIZE = 3 * 1024 * 1024;
export default {
  data: () => ({
    container: {
      file: null
    },
    chunks: []
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
        .map(({form,index}) => $axios.post('/upload',form, {
          onUploadProgress:this.createProgresshandler(this.chunks[index])
        }))
        
      const ret = await Promise.all(list)
      await this.mergeRequest();
    },
    createProgresshandler(item){
      return e=>{
        console.log(e,item)
        item.progress = parseInt(String((e.loaded / e.total) * 100))
      }
    },
    async mergeRequest() {
      await $axios.post('/merge',{
          filename: this.container.file.name,
          size:SIZE
        })

    },
    async handleUpload() {
      if (!this.container.file) return;
      console.log(Object.keys(this.container.file))
      // return 
      const chunks = this.createFileChunk(this.container.file);

      this.chunks = chunks.map((chunk, index) => ({
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