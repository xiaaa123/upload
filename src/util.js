/*
 * @Author: your name
 * @Date: 2021-01-22 10:23:23
 * @LastEditTime: 2021-01-22 13:58:27
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \新建文件夹\upload\src\util.js
 */

const baseUrl = 'http://localhost:3000'
export function request({
    url,
    method = "post",
    data,
    onProgress = e=>e,
    headers = {},
    requestList
}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = onProgress
        xhr.open(method, baseUrl+url);
        Object.keys(headers).forEach(key =>
            xhr.setRequestHeader(key, headers[key])
        );
        xhr.send(data);
        xhr.onreadystatechange = e => {
            if(xhr.readyState === 4) {
                if(xhr.status === 200){
                    if(requestList){
                        // 成功后删除列表
                        const i = requestList.findIndex(req=>req===xhr)
                        requestList.splice(i, 1)
                    }
                    resolve({
                        data: e.target.response
                    });
                }else if(xhr.status === 500){
                    reject('报错了 大哥')
                }
              }
        };
        // 存储 在vue中的this.requestList中 方便暂停 ?.信誉发
        // if(requestList.)
        requestList?.push(xhr)
        // requestList && requestList.push('shengxinjing')
    });
}
export async function post(url,data){
    let ret = await request({
        url,
        data: JSON.stringify(data),
        headers: {
          "content-type": "application/json"
        }
    })
    return JSON.parse(ret.data)
}

function ts (gen) {
    if (typeof gen === 'function') gen = gen()
    if (!gen || typeof gen.next !== 'function') return
    return function next() {
      const res = gen.next()
      if (res.done) return
      setTimeout(next)
    }
  }
  