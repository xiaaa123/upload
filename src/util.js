


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

function ts (gen) {
    if (typeof gen === 'function') gen = gen()
    if (!gen || typeof gen.next !== 'function') return
    return function next() {
      const res = gen.next()
      if (res.done) return
      setTimeout(next)
    }
  }
  


function ts1 (gen) {
    if (typeof gen === 'function') gen = gen()
    if (!gen || typeof gen.next !== 'function') return
  
    return function next () {
      const start = performance.now()
      let res = null
      do {
        res = gen.next()
      } while(!res.done && performance.now() - start < 25);
  
      if (res.done) return
      setTimeout(next)
    }
  }
//   ts1(function* () {
//     const start = performance.now()
//     while (performance.now() - start < 1000) {
//       console.log(11)
//       yield
//     }
//     console.log('done!')
//   })();

// generator函数
function* gen(x){
    var y = yield x + 2;
    return y;
}
let g = gen(1)
console.log(g)
console.log(g.next())
console.log(g.next())

// 上面代码中，调用 Generator 函数，会返回一个内部指针（即遍历器 ）g 。
// 这是 Generator 函数不同于普通函数的另一个地方，即执行它不会返回结果，返回的是指针对象。
// 」调用指针 g 的 next 方法，会移动内部指针（即执行异步任务的第一段），
// 指向第一个遇到的 yield 语句，上例是执行到 x + 2 为止。

// 换言之，next 方法的作用是分阶段执行 Generator 函数。
// 每次调用 next 方法，会返回一个对象，
// 」表示当前阶段的信息（ value 属性和 done 属性）。value 属性是 yield 语句后面表达式的值，
// 表示当前阶段的值；done 属性是一个布尔值，表示 Generator 函数是否执行完毕，即是否还有下一个阶段。