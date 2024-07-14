/*
 * Author: Gagan Jakhotiya
 * Date: 2024-05-05
 * Description: This file contains factory impl of cacheifying
 * any async function.
 *
 */

function asyncMemoizerFactory() {
  /*
   * {
   *   [fnName<-OptionalBase64EncodedArgs>: string]: {
   *      response: Object;
   *      expiryTs: number;
   *    }
   *  }
   */
  let cacheStore = {};

  function decache() {
    cacheStore = {};
  }

  function clearInvalidCaches() {
    const nowMillis = new Date().getTime();
    Object.keys(cacheStore).forEach((cacheKey) => {
      if (
        typeof cacheStore[cacheKey] === "object" &&
        cacheStore[cacheKey].expiryTs < nowMillis
      ) {
        delete cacheStore[cacheKey];
      }
    });
  }

  function getCacheKey(fnName, args) {
    return args.length ? `${fnName}-${btoa(JSON.stringify(args))}` : fnName;
  }

  function resetFromCacheFactory(fnName) {
    Object.keys(cacheStore)
      .filter((key) => key.startsWith(fnName))
      .forEach((cacheKeyWithArgs) => {
        delete cacheStore[cacheKeyWithArgs];
      });
    cacheStore[fnName] = true;
  }

  function getFromCacheFactory(fnName, args) {
    const cacheKey = getCacheKey(fnName, args);
    const cacheResult = cacheStore[cacheKey];
    if (typeof cacheResult === "object") {
      console.log(
        "[CACHE]",
        new Date().getTime() < cacheResult.expiryTs ? "HIT" : "MISS",
        cacheKey
      );
      if (new Date().getTime() < cacheResult.expiryTs) {
        return cacheResult.response;
      }
    }
  }

  function setFromCacheFactory(fnName, ttlInMillis, args, response) {
    const cacheKey = getCacheKey(fnName, args);
    cacheStore[cacheKey] = {
      response,
      expiryTs: new Date().getTime() + ttlInMillis,
    };
  }

  const asyncMemoizerInstance = function (asyncFn, ttlInMillis) {
    const fnName = asyncFn.name;
    if (fnName === "") {
      throw 'Only named functions can use "asyncMemoizer"!';
    }
    if (cacheStore[fnName]) {
      throw `Function with name "${fnName}" already registered with the cache factory!`;
    }

    console.log("[MEMO]", fnName, ttlInMillis);
    cacheStore[fnName] = true;

    const cachedAsyncFn = function (...args) {
      const cachedResponse = getFromCacheFactory(fnName, args);
      if (cachedResponse !== undefined) {
        return Promise.resolve(cachedResponse);
      } else {
        return asyncFn(...args).then((response) => {
          setFromCacheFactory(fnName, ttlInMillis, args, response);
          return response;
        });
      }
    };

    cachedAsyncFn.prototype.clearCache = function () {
      resetFromCacheFactory(fnName);
    };

    return cachedAsyncFn;
  };

  asyncMemoizerInstance.decache = decache;
  asyncMemoizerInstance.clearInvalidCaches = clearInvalidCaches;

  return asyncMemoizerInstance;
}

exports.asyncMemoizerFactory = asyncMemoizerFactory;
exports.defaultAsyncMemoizer = asyncMemoizerFactory();
