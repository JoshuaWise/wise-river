'use strict';
const Promise = require('honest-promise');
const Observable = require('./observable');
const shared = require('./shared');
const exception = { reason: undefined };

class HonestStreamBase extends Observable {
	
	constructor(fn) {
		let xrs, xrj, open = true;
		super((rs, rj) => { xrs = rs; xrj = rj; });
		
		const reject = reason => { open = false; xrj(reason); super[shared.close](); };
		const superWrite = item => super[shared.write](item);
		
		const resolve = (defer) => {
			if (open) {
				open = false;
				const close = () => {
					if (this[shared.onabort] !== reject) return;
					const finalize = () => { xrs(); super[shared.close](); };
					if (super[shared.isEmptyAndIdle]()) finalize();
					else this[shared.onempty] = finalize;
				};
				if (Promise.isPromise(defer)) Promise.resolve(defer).then(close, reject);
				else close();
			}
		};
		
		const write = (item) => { // TODO: handle correctly when open === false
			if (open) {
				Promise.resolve(item).then(superWrite, reject);
			} else {
				Promise.resolve(item).then(undefined, () => {});
				throw new Error('Cannot write to stream after it is resolved or rejected');
			}
		};
		
		this[shared.onabort] = reject;
		
		if (tryCatch(fn, resolve, reject, write) === exception) {
			reject(exception.reason);
		}
		
		// OPTIMIZATION?: should items be written synchronously in some cases?
		// OPTIMIZATION?: could writing non-promise values be cheaper by using `alreadyFulfilled.then(() => superWrite(item), reject)`?
		// TODO: think about how to propagate fate backwards (close underlying resource)
	}
	
	observe(concurrency, handler) {
		if (typeof concurrency === 'function') {
			handler = arguments[0];
			concurrency = arguments[1];
		} else if (typeof handler !== 'function') {
			throw new TypeError('Expected first or second argument to be a function');
		}
		super[shared.attachHandler](handler, concurrency);
		return this;
	}
}

const tryCatch = (fn, arg1, arg2, arg3) => {
	try { fn(arg1, arg2, arg3); }
	catch (err) { exception.reason = err; return exception; }
};

module.exports = HonestStreamBase;