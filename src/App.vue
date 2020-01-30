<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <el-button type="primary" @click="handleUpload">上传</el-button>

    <div>

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
// @todo size切分
// @todo canvas方块进度条
// @todo 并发量控制+报错重试
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
    async handleUpload() {
      if (!this.container.file) return;
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