


const baseUrl = 'http://localhost:3000'
export function request({
    url,
    method = "post",
    data,
    onProgress = e=>e,
    headers = {},
    requestList
}) {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = onProgress
        xhr.open(method, baseUrl+url);
        Object.keys(headers).forEach(key =>
            xhr.setRequestHeader(key, headers[key])
        );
        xhr.send(data);
        xhr.onload = e => {
            if(requestList){
                // 成功后删除列表
                const i = requestList.findIndex(req=>req===xhr)
                requestList.splice(i, 1)
            }
            resolve({
                data: e.target.response
            });
        };
        // 存储 在vue中的this.requestList中 方便暂停 ?.信誉发
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




