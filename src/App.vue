<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <el-button type="primary" @click="handleUpload">上传</el-button>
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
        .map(({ chunk, hash }, i) => {
          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("hash", hash);
          formData.append("filename", this.container.file.name);
          return formData;
        })
        .map(form => request({ url: "http://localhost:3000/upload", data: form }));
      const ret = await Promise.all(list)
      console.log(ret)
      await this.mergeRequest();
    },
    async mergeRequest() {
      console.log('>')
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

      this.chunks = chunks.map((chunk, i) => ({
        chunk: chunk.file,
        hash: this.container.file.name + "-" + i
      }));
      // console.log(this.chunks)
      await this.uploadChunks();
    }
  }
};
</script>