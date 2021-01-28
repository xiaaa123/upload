/*
 * @Author: your name
 * @Date: 2021-01-22 10:23:23
 * @LastEditTime: 2021-01-22 14:21:40
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \新建文件夹\upload\server\demo.js
 */

function SendRequest (urls,max,callback) {
	let i = 0;
    const alltasks = [];
    const executing = [];
	const fifo = function () {
		if( urls.length === 0){
			return Promise.resolve();
		}
		const item = urls[i++];
		const pr = Promise.resolve().then(() => fetch(item));
		alltasks.push(pr);
		const end = pr.then(() => executing.splice(executing.indexOf(end), 1))
		executing.push(end);
		let r = Promise.resolve();
		if (executing.length >= poolLimit) {
			r = Promise.race(executing);
		}
	}
	 return fifo().then(() => Promise.all(alltasks));
}