if (!("withResolvers" in Promise)) {
  // polyfill for node.js
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to =
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true,
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/tapable/lib/Hook.js
var require_Hook = __commonJS((exports, module) => {
  function createCompileDelegate(name, type) {
    return function lazyCompileHook(...args) {
      this[name] = this._createCall(type);
      return this[name](...args);
    };
  }

  class Hook {
    constructor(args) {
      if (!Array.isArray(args)) args = [];
      this._args = args;
      this.taps = [];
      this.interceptors = [];
      this.call = this._call;
      this.promise = this._promise;
      this.callAsync = this._callAsync;
      this._x = undefined;
    }
    compile(options) {
      throw new Error("Abstract: should be overriden");
    }
    _createCall(type) {
      return this.compile({
        taps: this.taps,
        interceptors: this.interceptors,
        args: this._args,
        type,
      });
    }
    tap(options, fn) {
      if (typeof options === "string") options = { name: options };
      if (typeof options !== "object" || options === null)
        throw new Error("Invalid arguments to tap(options: Object, fn: function)");
      options = Object.assign({ type: "sync", fn }, options);
      if (typeof options.name !== "string" || options.name === "") throw new Error("Missing name for tap");
      options = this._runRegisterInterceptors(options);
      this._insert(options);
    }
    tapAsync(options, fn) {
      if (typeof options === "string") options = { name: options };
      if (typeof options !== "object" || options === null)
        throw new Error("Invalid arguments to tapAsync(options: Object, fn: function)");
      options = Object.assign({ type: "async", fn }, options);
      if (typeof options.name !== "string" || options.name === "") throw new Error("Missing name for tapAsync");
      options = this._runRegisterInterceptors(options);
      this._insert(options);
    }
    tapPromise(options, fn) {
      if (typeof options === "string") options = { name: options };
      if (typeof options !== "object" || options === null)
        throw new Error("Invalid arguments to tapPromise(options: Object, fn: function)");
      options = Object.assign({ type: "promise", fn }, options);
      if (typeof options.name !== "string" || options.name === "") throw new Error("Missing name for tapPromise");
      options = this._runRegisterInterceptors(options);
      this._insert(options);
    }
    _runRegisterInterceptors(options) {
      for (const interceptor of this.interceptors) {
        if (interceptor.register) {
          const newOptions = interceptor.register(options);
          if (newOptions !== undefined) options = newOptions;
        }
      }
      return options;
    }
    withOptions(options) {
      const mergeOptions = (opt) => Object.assign({}, options, typeof opt === "string" ? { name: opt } : opt);
      options = Object.assign({}, options, this._withOptions);
      const base = this._withOptionsBase || this;
      const newHook = Object.create(base);
      (newHook.tapAsync = (opt, fn) => base.tapAsync(mergeOptions(opt), fn)),
        (newHook.tap = (opt, fn) => base.tap(mergeOptions(opt), fn));
      newHook.tapPromise = (opt, fn) => base.tapPromise(mergeOptions(opt), fn);
      newHook._withOptions = options;
      newHook._withOptionsBase = base;
      return newHook;
    }
    isUsed() {
      return this.taps.length > 0 || this.interceptors.length > 0;
    }
    intercept(interceptor) {
      this._resetCompilation();
      this.interceptors.push(Object.assign({}, interceptor));
      if (interceptor.register) {
        for (let i = 0; i < this.taps.length; i++) this.taps[i] = interceptor.register(this.taps[i]);
      }
    }
    _resetCompilation() {
      this.call = this._call;
      this.callAsync = this._callAsync;
      this.promise = this._promise;
    }
    _insert(item) {
      this._resetCompilation();
      let before;
      if (typeof item.before === "string") before = new Set([item.before]);
      else if (Array.isArray(item.before)) {
        before = new Set(item.before);
      }
      let stage = 0;
      if (typeof item.stage === "number") stage = item.stage;
      let i = this.taps.length;
      while (i > 0) {
        i--;
        const x = this.taps[i];
        this.taps[i + 1] = x;
        const xStage = x.stage || 0;
        if (before) {
          if (before.has(x.name)) {
            before.delete(x.name);
            continue;
          }
          if (before.size > 0) {
            continue;
          }
        }
        if (xStage > stage) {
          continue;
        }
        i++;
        break;
      }
      this.taps[i] = item;
    }
  }
  Object.defineProperties(Hook.prototype, {
    _call: {
      value: createCompileDelegate("call", "sync"),
      configurable: true,
      writable: true,
    },
    _promise: {
      value: createCompileDelegate("promise", "promise"),
      configurable: true,
      writable: true,
    },
    _callAsync: {
      value: createCompileDelegate("callAsync", "async"),
      configurable: true,
      writable: true,
    },
  });
  module.exports = Hook;
});

// node_modules/tapable/lib/HookCodeFactory.js
var require_HookCodeFactory = __commonJS((exports, module) => {
  class HookCodeFactory {
    constructor(config) {
      this.config = config;
      this.options = undefined;
      this._args = undefined;
    }
    create(options) {
      this.init(options);
      let fn;
      switch (this.options.type) {
        case "sync":
          fn = new Function(
            this.args(),
            '"use strict";\n' +
              this.header() +
              this.content({
                onError: (err) => `throw ${err};\n`,
                onResult: (result) => `return ${result};\n`,
                resultReturns: true,
                onDone: () => "",
                rethrowIfPossible: true,
              })
          );
          break;
        case "async":
          fn = new Function(
            this.args({
              after: "_callback",
            }),
            '"use strict";\n' +
              this.header() +
              this.content({
                onError: (err) => `_callback(${err});\n`,
                onResult: (result) => `_callback(null, ${result});\n`,
                onDone: () => "_callback();\n",
              })
          );
          break;
        case "promise":
          let errorHelperUsed = false;
          const content = this.content({
            onError: (err) => {
              errorHelperUsed = true;
              return `_error(${err});\n`;
            },
            onResult: (result) => `_resolve(${result});\n`,
            onDone: () => "_resolve();\n",
          });
          let code = "";
          code += '"use strict";\n';
          code += "return new Promise((_resolve, _reject) => {\n";
          if (errorHelperUsed) {
            code += "var _sync = true;\n";
            code += "function _error(_err) {\n";
            code += "if(_sync)\n";
            code += "_resolve(Promise.resolve().then(() => { throw _err; }));\n";
            code += "else\n";
            code += "_reject(_err);\n";
            code += "};\n";
          }
          code += this.header();
          code += content;
          if (errorHelperUsed) {
            code += "_sync = false;\n";
          }
          code += "});\n";
          fn = new Function(this.args(), code);
          break;
      }
      this.deinit();
      return fn;
    }
    setup(instance, options) {
      instance._x = options.taps.map((t) => t.fn);
    }
    init(options) {
      this.options = options;
      this._args = options.args.slice();
    }
    deinit() {
      this.options = undefined;
      this._args = undefined;
    }
    header() {
      let code = "";
      if (this.needContext()) {
        code += "var _context = {};\n";
      } else {
        code += "var _context;\n";
      }
      code += "var _x = this._x;\n";
      if (this.options.interceptors.length > 0) {
        code += "var _taps = this.taps;\n";
        code += "var _interceptors = this.interceptors;\n";
      }
      for (let i = 0; i < this.options.interceptors.length; i++) {
        const interceptor = this.options.interceptors[i];
        if (interceptor.call) {
          code += `${this.getInterceptor(i)}.call(${this.args({
            before: interceptor.context ? "_context" : undefined,
          })});\n`;
        }
      }
      return code;
    }
    needContext() {
      for (const tap of this.options.taps) if (tap.context) return true;
      return false;
    }
    callTap(tapIndex, { onError, onResult, onDone, rethrowIfPossible }) {
      let code = "";
      let hasTapCached = false;
      for (let i = 0; i < this.options.interceptors.length; i++) {
        const interceptor = this.options.interceptors[i];
        if (interceptor.tap) {
          if (!hasTapCached) {
            code += `var _tap${tapIndex} = ${this.getTap(tapIndex)};\n`;
            hasTapCached = true;
          }
          code += `${this.getInterceptor(i)}.tap(${interceptor.context ? "_context, " : ""}_tap${tapIndex});\n`;
        }
      }
      code += `var _fn${tapIndex} = ${this.getTapFn(tapIndex)};\n`;
      const tap = this.options.taps[tapIndex];
      switch (tap.type) {
        case "sync":
          if (!rethrowIfPossible) {
            code += `var _hasError${tapIndex} = false;\n`;
            code += "try {\n";
          }
          if (onResult) {
            code += `var _result${tapIndex} = _fn${tapIndex}(${this.args({
              before: tap.context ? "_context" : undefined,
            })});\n`;
          } else {
            code += `_fn${tapIndex}(${this.args({
              before: tap.context ? "_context" : undefined,
            })});\n`;
          }
          if (!rethrowIfPossible) {
            code += "} catch(_err) {\n";
            code += `_hasError${tapIndex} = true;\n`;
            code += onError("_err");
            code += "}\n";
            code += `if(!_hasError${tapIndex}) {\n`;
          }
          if (onResult) {
            code += onResult(`_result${tapIndex}`);
          }
          if (onDone) {
            code += onDone();
          }
          if (!rethrowIfPossible) {
            code += "}\n";
          }
          break;
        case "async":
          let cbCode = "";
          if (onResult) cbCode += `(_err${tapIndex}, _result${tapIndex}) => {\n`;
          else cbCode += `_err${tapIndex} => {\n`;
          cbCode += `if(_err${tapIndex}) {\n`;
          cbCode += onError(`_err${tapIndex}`);
          cbCode += "} else {\n";
          if (onResult) {
            cbCode += onResult(`_result${tapIndex}`);
          }
          if (onDone) {
            cbCode += onDone();
          }
          cbCode += "}\n";
          cbCode += "}";
          code += `_fn${tapIndex}(${this.args({
            before: tap.context ? "_context" : undefined,
            after: cbCode,
          })});\n`;
          break;
        case "promise":
          code += `var _hasResult${tapIndex} = false;\n`;
          code += `var _promise${tapIndex} = _fn${tapIndex}(${this.args({
            before: tap.context ? "_context" : undefined,
          })});\n`;
          code += `if (!_promise${tapIndex} || !_promise${tapIndex}.then)\n`;
          code += `  throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise${tapIndex} + ')');\n`;
          code += `_promise${tapIndex}.then(_result${tapIndex} => {\n`;
          code += `_hasResult${tapIndex} = true;\n`;
          if (onResult) {
            code += onResult(`_result${tapIndex}`);
          }
          if (onDone) {
            code += onDone();
          }
          code += `}, _err${tapIndex} => {\n`;
          code += `if(_hasResult${tapIndex}) throw _err${tapIndex};\n`;
          code += onError(`_err${tapIndex}`);
          code += "});\n";
          break;
      }
      return code;
    }
    callTapsSeries({ onError, onResult, resultReturns, onDone, doneReturns, rethrowIfPossible }) {
      if (this.options.taps.length === 0) return onDone();
      const firstAsync = this.options.taps.findIndex((t) => t.type !== "sync");
      const somethingReturns = resultReturns || doneReturns || false;
      let code = "";
      let current = onDone;
      for (let j = this.options.taps.length - 1; j >= 0; j--) {
        const i = j;
        const unroll = current !== onDone && this.options.taps[i].type !== "sync";
        if (unroll) {
          code += `function _next${i}() {\n`;
          code += current();
          code += `}\n`;
          current = () => `${somethingReturns ? "return " : ""}_next${i}();\n`;
        }
        const done = current;
        const doneBreak = (skipDone) => {
          if (skipDone) return "";
          return onDone();
        };
        const content = this.callTap(i, {
          onError: (error) => onError(i, error, done, doneBreak),
          onResult:
            onResult &&
            ((result) => {
              return onResult(i, result, done, doneBreak);
            }),
          onDone: !onResult && done,
          rethrowIfPossible: rethrowIfPossible && (firstAsync < 0 || i < firstAsync),
        });
        current = () => content;
      }
      code += current();
      return code;
    }
    callTapsLooping({ onError, onDone, rethrowIfPossible }) {
      if (this.options.taps.length === 0) return onDone();
      const syncOnly = this.options.taps.every((t) => t.type === "sync");
      let code = "";
      if (!syncOnly) {
        code += "var _looper = () => {\n";
        code += "var _loopAsync = false;\n";
      }
      code += "var _loop;\n";
      code += "do {\n";
      code += "_loop = false;\n";
      for (let i = 0; i < this.options.interceptors.length; i++) {
        const interceptor = this.options.interceptors[i];
        if (interceptor.loop) {
          code += `${this.getInterceptor(i)}.loop(${this.args({
            before: interceptor.context ? "_context" : undefined,
          })});\n`;
        }
      }
      code += this.callTapsSeries({
        onError,
        onResult: (i, result, next, doneBreak) => {
          let code2 = "";
          code2 += `if(${result} !== undefined) {\n`;
          code2 += "_loop = true;\n";
          if (!syncOnly) code2 += "if(_loopAsync) _looper();\n";
          code2 += doneBreak(true);
          code2 += `} else {\n`;
          code2 += next();
          code2 += `}\n`;
          return code2;
        },
        onDone:
          onDone &&
          (() => {
            let code2 = "";
            code2 += "if(!_loop) {\n";
            code2 += onDone();
            code2 += "}\n";
            return code2;
          }),
        rethrowIfPossible: rethrowIfPossible && syncOnly,
      });
      code += "} while(_loop);\n";
      if (!syncOnly) {
        code += "_loopAsync = true;\n";
        code += "};\n";
        code += "_looper();\n";
      }
      return code;
    }
    callTapsParallel({ onError, onResult, onDone, rethrowIfPossible, onTap = (i, run) => run() }) {
      if (this.options.taps.length <= 1) {
        return this.callTapsSeries({
          onError,
          onResult,
          onDone,
          rethrowIfPossible,
        });
      }
      let code = "";
      code += "do {\n";
      code += `var _counter = ${this.options.taps.length};\n`;
      if (onDone) {
        code += "var _done = () => {\n";
        code += onDone();
        code += "};\n";
      }
      for (let i = 0; i < this.options.taps.length; i++) {
        const done = () => {
          if (onDone) return "if(--_counter === 0) _done();\n";
          else return "--_counter;";
        };
        const doneBreak = (skipDone) => {
          if (skipDone || !onDone) return "_counter = 0;\n";
          else return "_counter = 0;\n_done();\n";
        };
        code += "if(_counter <= 0) break;\n";
        code += onTap(
          i,
          () =>
            this.callTap(i, {
              onError: (error) => {
                let code2 = "";
                code2 += "if(_counter > 0) {\n";
                code2 += onError(i, error, done, doneBreak);
                code2 += "}\n";
                return code2;
              },
              onResult:
                onResult &&
                ((result) => {
                  let code2 = "";
                  code2 += "if(_counter > 0) {\n";
                  code2 += onResult(i, result, done, doneBreak);
                  code2 += "}\n";
                  return code2;
                }),
              onDone:
                !onResult &&
                (() => {
                  return done();
                }),
              rethrowIfPossible,
            }),
          done,
          doneBreak
        );
      }
      code += "} while(false);\n";
      return code;
    }
    args({ before, after } = {}) {
      let allArgs = this._args;
      if (before) allArgs = [before].concat(allArgs);
      if (after) allArgs = allArgs.concat(after);
      if (allArgs.length === 0) {
        return "";
      } else {
        return allArgs.join(", ");
      }
    }
    getTapFn(idx) {
      return `_x[${idx}]`;
    }
    getTap(idx) {
      return `_taps[${idx}]`;
    }
    getInterceptor(idx) {
      return `_interceptors[${idx}]`;
    }
  }
  module.exports = HookCodeFactory;
});

// node_modules/tapable/lib/SyncBailHook.js
var require_SyncBailHook = __commonJS((exports, module) => {
  var Hook = require_Hook();
  var HookCodeFactory = require_HookCodeFactory();

  class SyncBailHookCodeFactory extends HookCodeFactory {
    content({ onError, onResult, resultReturns, onDone, rethrowIfPossible }) {
      return this.callTapsSeries({
        onError: (i, err) => onError(err),
        onResult: (i, result, next) => `if(${result} !== undefined) {\n${onResult(result)};\n} else {\n${next()}}\n`,
        resultReturns,
        onDone,
        rethrowIfPossible,
      });
    }
  }
  var factory = new SyncBailHookCodeFactory();

  class SyncBailHook extends Hook {
    tapAsync() {
      throw new Error("tapAsync is not supported on a SyncBailHook");
    }
    tapPromise() {
      throw new Error("tapPromise is not supported on a SyncBailHook");
    }
    compile(options) {
      factory.setup(this, options);
      return factory.create(options);
    }
  }
  module.exports = SyncBailHook;
});

// node_modules/tapable/lib/Tapable.js
var require_Tapable = __commonJS((exports, module) => {
  function Tapable() {
    this._pluginCompat = new SyncBailHook(["options"]);
    this._pluginCompat.tap(
      {
        name: "Tapable camelCase",
        stage: 100,
      },
      (options) => {
        options.names.add(options.name.replace(/[- ]([a-z])/g, (str, ch) => ch.toUpperCase()));
      }
    );
    this._pluginCompat.tap(
      {
        name: "Tapable this.hooks",
        stage: 200,
      },
      (options) => {
        let hook;
        for (const name of options.names) {
          hook = this.hooks[name];
          if (hook !== undefined) {
            break;
          }
        }
        if (hook !== undefined) {
          const tapOpt = {
            name: options.fn.name || "unnamed compat plugin",
            stage: options.stage || 0,
          };
          if (options.async) hook.tapAsync(tapOpt, options.fn);
          else hook.tap(tapOpt, options.fn);
          return true;
        }
      }
    );
  }
  var util = __require("util");
  var SyncBailHook = require_SyncBailHook();
  module.exports = Tapable;
  Tapable.addCompatLayer = function addCompatLayer(instance) {
    Tapable.call(instance);
    instance.plugin = Tapable.prototype.plugin;
    instance.apply = Tapable.prototype.apply;
  };
  Tapable.prototype.plugin = util.deprecate(function plugin(name, fn) {
    if (Array.isArray(name)) {
      name.forEach(function (name2) {
        this.plugin(name2, fn);
      }, this);
      return;
    }
    const result = this._pluginCompat.call({
      name,
      fn,
      names: new Set([name]),
    });
    if (!result) {
      throw new Error(
        `Plugin could not be registered at '${name}'. Hook was not found.\n` +
          "BREAKING CHANGE: There need to exist a hook at 'this.hooks'. " +
          "To create a compatibility layer for this hook, hook into 'this._pluginCompat'."
      );
    }
  }, "Tapable.plugin is deprecated. Use new API on `.hooks` instead");
  Tapable.prototype.apply = util.deprecate(function apply() {
    for (var i = 0; i < arguments.length; i++) {
      arguments[i].apply(this);
    }
  }, "Tapable.apply is deprecated. Call apply on the plugin directly instead");
});

// node_modules/tapable/lib/SyncHook.js
var require_SyncHook = __commonJS((exports, module) => {
  var Hook = require_Hook();
  var HookCodeFactory = require_HookCodeFactory();

  class SyncHookCodeFactory extends HookCodeFactory {
    content({ onError, onDone, rethrowIfPossible }) {
      return this.callTapsSeries({
        onError: (i, err) => onError(err),
        onDone,
        rethrowIfPossible,
      });
    }
  }
  var factory = new SyncHookCodeFactory();

  class SyncHook extends Hook {
    tapAsync() {
      throw new Error("tapAsync is not supported on a SyncHook");
    }
    tapPromise() {
      throw new Error("tapPromise is not supported on a SyncHook");
    }
    compile(options) {
      factory.setup(this, options);
      return factory.create(options);
    }
  }
  module.exports = SyncHook;
});

// node_modules/tapable/lib/AsyncSeriesBailHook.js
var require_AsyncSeriesBailHook = __commonJS((exports, module) => {
  var Hook = require_Hook();
  var HookCodeFactory = require_HookCodeFactory();

  class AsyncSeriesBailHookCodeFactory extends HookCodeFactory {
    content({ onError, onResult, resultReturns, onDone }) {
      return this.callTapsSeries({
        onError: (i, err, next, doneBreak) => onError(err) + doneBreak(true),
        onResult: (i, result, next) => `if(${result} !== undefined) {\n${onResult(result)};\n} else {\n${next()}}\n`,
        resultReturns,
        onDone,
      });
    }
  }
  var factory = new AsyncSeriesBailHookCodeFactory();

  class AsyncSeriesBailHook extends Hook {
    compile(options) {
      factory.setup(this, options);
      return factory.create(options);
    }
  }
  Object.defineProperties(AsyncSeriesBailHook.prototype, {
    _call: { value: undefined, configurable: true, writable: true },
  });
  module.exports = AsyncSeriesBailHook;
});

// node_modules/tapable/lib/AsyncSeriesHook.js
var require_AsyncSeriesHook = __commonJS((exports, module) => {
  var Hook = require_Hook();
  var HookCodeFactory = require_HookCodeFactory();

  class AsyncSeriesHookCodeFactory extends HookCodeFactory {
    content({ onError, onDone }) {
      return this.callTapsSeries({
        onError: (i, err, next, doneBreak) => onError(err) + doneBreak(true),
        onDone,
      });
    }
  }
  var factory = new AsyncSeriesHookCodeFactory();

  class AsyncSeriesHook extends Hook {
    compile(options) {
      factory.setup(this, options);
      return factory.create(options);
    }
  }
  Object.defineProperties(AsyncSeriesHook.prototype, {
    _call: { value: undefined, configurable: true, writable: true },
  });
  module.exports = AsyncSeriesHook;
});

// node_modules/enhanced-resolve/lib/createInnerContext.js
var require_createInnerContext = __commonJS((exports, module) => {
  module.exports = function createInnerContext(options, message, messageOptional) {
    let messageReported = false;
    const childContext = {
      log: (() => {
        if (!options.log) return;
        if (!message) return options.log;
        const logFunction = (msg) => {
          if (!messageReported) {
            options.log(message);
            messageReported = true;
          }
          options.log("  " + msg);
        };
        return logFunction;
      })(),
      stack: options.stack,
      missing: options.missing,
    };
    return childContext;
  };
});

// node_modules/memory-fs/lib/normalize.js
var require_normalize = __commonJS((exports, module) => {
  module.exports = function normalize(path) {
    var parts = path.split(/(\\+|\/+)/);
    if (parts.length === 1) return path;
    var result = [];
    var absolutePathStart = 0;
    for (var i = 0, sep = false; i < parts.length; i += 1, sep = !sep) {
      var part = parts[i];
      if (i === 0 && /^([A-Z]:)?$/i.test(part)) {
        result.push(part);
        absolutePathStart = 2;
      } else if (sep) {
        if (i === 1 && parts[0].length === 0 && part === "\\\\") {
          result.push(part);
        } else {
          result.push(part[0]);
        }
      } else if (part === "..") {
        switch (result.length) {
          case 0:
            result.push(part);
            break;
          case 2:
            if (result[0] !== ".") {
              i += 1;
              sep = !sep;
              result.length = absolutePathStart;
            } else {
              result.length = 0;
              result.push(part);
            }
            break;
          case 4:
            if (absolutePathStart === 0) {
              result.length -= 3;
            } else {
              i += 1;
              sep = !sep;
              result.length = 2;
            }
            break;
          default:
            result.length -= 3;
            break;
        }
      } else if (part === ".") {
        switch (result.length) {
          case 0:
            result.push(part);
            break;
          case 2:
            if (absolutePathStart === 0) {
              result.length -= 1;
            } else {
              i += 1;
              sep = !sep;
            }
            break;
          default:
            result.length -= 1;
            break;
        }
      } else if (part) {
        result.push(part);
      }
    }
    if (result.length === 1 && /^[A-Za-z]:$/.test(result[0])) return result[0] + "\\";
    return result.join("");
  };
});

// node_modules/memory-fs/lib/join.js
var require_join = __commonJS((exports, module) => {
  var normalize = require_normalize();
  var absoluteWinRegExp = /^[A-Z]:([\\\/]|$)/i;
  var absoluteNixRegExp = /^\//i;
  module.exports = function join(path, request) {
    if (!request) return normalize(path);
    if (absoluteWinRegExp.test(request)) return normalize(request.replace(/\//g, "\\"));
    if (absoluteNixRegExp.test(request)) return normalize(request);
    if (path == "/") return normalize(path + request);
    if (absoluteWinRegExp.test(path)) return normalize(path.replace(/\//g, "\\") + "\\" + request.replace(/\//g, "\\"));
    if (absoluteNixRegExp.test(path)) return normalize(path + "/" + request);
    return normalize(path + "/" + request);
  };
});

// node_modules/enhanced-resolve/lib/Resolver.js
var require_Resolver = __commonJS((exports, module) => {
  function withName(name, hook) {
    hook.name = name;
    return hook;
  }
  function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (str2) => str2.substr(1).toUpperCase());
  }
  var util = __require("util");
  var Tapable = require_Tapable();
  var SyncHook = require_SyncHook();
  var AsyncSeriesBailHook = require_AsyncSeriesBailHook();
  var AsyncSeriesHook = require_AsyncSeriesHook();
  var createInnerContext = require_createInnerContext();
  var REGEXP_NOT_MODULE = /^\.$|^\.[\\/]|^\.\.$|^\.\.[\\/]|^\/|^[A-Z]:[\\/]/i;
  var REGEXP_DIRECTORY = /[\\/]$/i;
  var memoryFsJoin = require_join();
  var memoizedJoin = new Map();
  var memoryFsNormalize = require_normalize();
  var deprecatedPushToMissing = util.deprecate((set, item) => {
    set.add(item);
  }, "Resolver: 'missing' is now a Set. Use add instead of push.");
  var deprecatedResolveContextInCallback = util.deprecate((x) => {
    return x;
  }, "Resolver: The callback argument was splitted into resolveContext and callback.");
  var deprecatedHookAsString = util.deprecate((x) => {
    return x;
  }, "Resolver#doResolve: The type arguments (string) is now a hook argument (Hook). Pass a reference to the hook instead.");

  class Resolver extends Tapable {
    constructor(fileSystem) {
      super();
      this.fileSystem = fileSystem;
      this.hooks = {
        resolveStep: withName("resolveStep", new SyncHook(["hook", "request"])),
        noResolve: withName("noResolve", new SyncHook(["request", "error"])),
        resolve: withName("resolve", new AsyncSeriesBailHook(["request", "resolveContext"])),
        result: new AsyncSeriesHook(["result", "resolveContext"]),
      };
      this._pluginCompat.tap("Resolver: before/after", (options) => {
        if (/^before-/.test(options.name)) {
          options.name = options.name.substr(7);
          options.stage = -10;
        } else if (/^after-/.test(options.name)) {
          options.name = options.name.substr(6);
          options.stage = 10;
        }
      });
      this._pluginCompat.tap("Resolver: step hooks", (options) => {
        const name = options.name;
        const stepHook = !/^resolve(-s|S)tep$|^no(-r|R)esolve$/.test(name);
        if (stepHook) {
          options.async = true;
          this.ensureHook(name);
          const fn = options.fn;
          options.fn = (request, resolverContext, callback) => {
            const innerCallback = (err, result) => {
              if (err) return callback(err);
              if (result !== undefined) return callback(null, result);
              callback();
            };
            for (const key in resolverContext) {
              innerCallback[key] = resolverContext[key];
            }
            fn.call(this, request, innerCallback);
          };
        }
      });
    }
    ensureHook(name) {
      if (typeof name !== "string") return name;
      name = toCamelCase(name);
      if (/^before/.test(name)) {
        return this.ensureHook(name[6].toLowerCase() + name.substr(7)).withOptions({
          stage: -10,
        });
      }
      if (/^after/.test(name)) {
        return this.ensureHook(name[5].toLowerCase() + name.substr(6)).withOptions({
          stage: 10,
        });
      }
      const hook = this.hooks[name];
      if (!hook) {
        return (this.hooks[name] = withName(name, new AsyncSeriesBailHook(["request", "resolveContext"])));
      }
      return hook;
    }
    getHook(name) {
      if (typeof name !== "string") return name;
      name = toCamelCase(name);
      if (/^before/.test(name)) {
        return this.getHook(name[6].toLowerCase() + name.substr(7)).withOptions({
          stage: -10,
        });
      }
      if (/^after/.test(name)) {
        return this.getHook(name[5].toLowerCase() + name.substr(6)).withOptions({
          stage: 10,
        });
      }
      const hook = this.hooks[name];
      if (!hook) {
        throw new Error(`Hook ${name} doesn't exist`);
      }
      return hook;
    }
    resolveSync(context, path, request) {
      let err,
        result,
        sync = false;
      this.resolve(context, path, request, {}, (e, r) => {
        err = e;
        result = r;
        sync = true;
      });
      if (!sync) throw new Error("Cannot 'resolveSync' because the fileSystem is not sync. Use 'resolve'!");
      if (err) throw err;
      return result;
    }
    resolve(context, path, request, resolveContext, callback) {
      if (typeof callback !== "function") {
        callback = deprecatedResolveContextInCallback(resolveContext);
      }
      const obj = {
        context,
        path,
        request,
      };
      const message = "resolve '" + request + "' in '" + path + "'";
      return this.doResolve(
        this.hooks.resolve,
        obj,
        message,
        {
          missing: resolveContext.missing,
          stack: resolveContext.stack,
        },
        (err, result) => {
          if (!err && result) {
            return callback(null, result.path === false ? false : result.path + (result.query || ""), result);
          }
          const localMissing = new Set();
          localMissing.push = (item) => deprecatedPushToMissing(localMissing, item);
          const log = [];
          return this.doResolve(
            this.hooks.resolve,
            obj,
            message,
            {
              log: (msg) => {
                if (resolveContext.log) {
                  resolveContext.log(msg);
                }
                log.push(msg);
              },
              missing: localMissing,
              stack: resolveContext.stack,
            },
            (err2, result2) => {
              if (err2) return callback(err2);
              const error = new Error("Can't " + message);
              error.details = log.join("\n");
              error.missing = Array.from(localMissing);
              this.hooks.noResolve.call(obj, error);
              return callback(error);
            }
          );
        }
      );
    }
    doResolve(hook, request, message, resolveContext, callback) {
      if (typeof callback !== "function") {
        callback = deprecatedResolveContextInCallback(resolveContext);
      }
      if (typeof hook === "string") {
        const name = toCamelCase(hook);
        hook = deprecatedHookAsString(this.hooks[name]);
        if (!hook) {
          throw new Error(`Hook "${name}" doesn't exist`);
        }
      }
      if (typeof callback !== "function") throw new Error("callback is not a function " + Array.from(arguments));
      if (!resolveContext) throw new Error("resolveContext is not an object " + Array.from(arguments));
      const stackLine =
        hook.name +
        ": (" +
        request.path +
        ") " +
        (request.request || "") +
        (request.query || "") +
        (request.directory ? " directory" : "") +
        (request.module ? " module" : "");
      let newStack;
      if (resolveContext.stack) {
        newStack = new Set(resolveContext.stack);
        if (resolveContext.stack.has(stackLine)) {
          const recursionError = new Error("Recursion in resolving\nStack:\n  " + Array.from(newStack).join("\n  "));
          recursionError.recursion = true;
          if (resolveContext.log) resolveContext.log("abort resolving because of recursion");
          return callback(recursionError);
        }
        newStack.add(stackLine);
      } else {
        newStack = new Set([stackLine]);
      }
      this.hooks.resolveStep.call(hook, request);
      if (hook.isUsed()) {
        const innerContext = createInnerContext(
          {
            log: resolveContext.log,
            missing: resolveContext.missing,
            stack: newStack,
          },
          message
        );
        return hook.callAsync(request, innerContext, (err, result) => {
          if (err) return callback(err);
          if (result) return callback(null, result);
          callback();
        });
      } else {
        callback();
      }
    }
    parse(identifier) {
      if (identifier === "") return null;
      const part = {
        request: "",
        query: "",
        module: false,
        directory: false,
        file: false,
      };
      const idxQuery = identifier.indexOf("?");
      if (idxQuery === 0) {
        part.query = identifier;
      } else if (idxQuery > 0) {
        part.request = identifier.slice(0, idxQuery);
        part.query = identifier.slice(idxQuery);
      } else {
        part.request = identifier;
      }
      if (part.request) {
        part.module = this.isModule(part.request);
        part.directory = this.isDirectory(part.request);
        if (part.directory) {
          part.request = part.request.substr(0, part.request.length - 1);
        }
      }
      return part;
    }
    isModule(path) {
      return !REGEXP_NOT_MODULE.test(path);
    }
    isDirectory(path) {
      return REGEXP_DIRECTORY.test(path);
    }
    join(path, request) {
      let cacheEntry;
      let pathCache = memoizedJoin.get(path);
      if (typeof pathCache === "undefined") {
        memoizedJoin.set(path, (pathCache = new Map()));
      } else {
        cacheEntry = pathCache.get(request);
        if (typeof cacheEntry !== "undefined") return cacheEntry;
      }
      cacheEntry = memoryFsJoin(path, request);
      pathCache.set(request, cacheEntry);
      return cacheEntry;
    }
    normalize(path) {
      return memoryFsNormalize(path);
    }
  }
  module.exports = Resolver;
});

// node_modules/enhanced-resolve/lib/SyncAsyncFileSystemDecorator.js
var require_SyncAsyncFileSystemDecorator = __commonJS((exports, module) => {
  function SyncAsyncFileSystemDecorator(fs) {
    this.fs = fs;
    if (fs.statSync) {
      this.stat = function (arg, callback) {
        let result;
        try {
          result = fs.statSync(arg);
        } catch (e) {
          return callback(e);
        }
        callback(null, result);
      };
    }
    if (fs.readdirSync) {
      this.readdir = function (arg, callback) {
        let result;
        try {
          result = fs.readdirSync(arg);
        } catch (e) {
          return callback(e);
        }
        callback(null, result);
      };
    }
    if (fs.readFileSync) {
      this.readFile = function (arg, callback) {
        let result;
        try {
          result = fs.readFileSync(arg);
        } catch (e) {
          return callback(e);
        }
        callback(null, result);
      };
    }
    if (fs.readlinkSync) {
      this.readlink = function (arg, callback) {
        let result;
        try {
          result = fs.readlinkSync(arg);
        } catch (e) {
          return callback(e);
        }
        callback(null, result);
      };
    }
    if (fs.readJsonSync) {
      this.readJson = function (arg, callback) {
        let result;
        try {
          result = fs.readJsonSync(arg);
        } catch (e) {
          return callback(e);
        }
        callback(null, result);
      };
    }
  }
  module.exports = SyncAsyncFileSystemDecorator;
});

// node_modules/enhanced-resolve/lib/ParsePlugin.js
var require_ParsePlugin = __commonJS((exports, module) => {
  module.exports = class ParsePlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ParsePlugin", (request, resolveContext, callback) => {
        const parsed = resolver.parse(request.request);
        const obj = Object.assign({}, request, parsed);
        if (request.query && !parsed.query) {
          obj.query = request.query;
        }
        if (parsed && resolveContext.log) {
          if (parsed.module) resolveContext.log("Parsed request is a module");
          if (parsed.directory) resolveContext.log("Parsed request is a directory");
        }
        resolver.doResolve(target, obj, null, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/forEachBail.js
var require_forEachBail = __commonJS((exports, module) => {
  module.exports = function forEachBail(array, iterator, callback) {
    if (array.length === 0) return callback();
    let currentPos = array.length;
    let currentResult;
    let done = [];
    for (let i = 0; i < array.length; i++) {
      const itCb = createIteratorCallback(i);
      iterator(array[i], itCb);
      if (currentPos === 0) break;
    }
    function createIteratorCallback(i) {
      return (...args) => {
        if (i >= currentPos) return;
        done.push(i);
        if (args.length > 0) {
          currentPos = i + 1;
          done = done.filter((item) => {
            return item <= i;
          });
          currentResult = args;
        }
        if (done.length === currentPos) {
          callback.apply(null, currentResult);
          currentPos = 0;
        }
      };
    }
  };
  module.exports.withIndex = function forEachBailWithIndex(array, iterator, callback) {
    if (array.length === 0) return callback();
    let currentPos = array.length;
    let currentResult;
    let done = [];
    for (let i = 0; i < array.length; i++) {
      const itCb = createIteratorCallback(i);
      iterator(array[i], i, itCb);
      if (currentPos === 0) break;
    }
    function createIteratorCallback(i) {
      return (...args) => {
        if (i >= currentPos) return;
        done.push(i);
        if (args.length > 0) {
          currentPos = i + 1;
          done = done.filter((item) => {
            return item <= i;
          });
          currentResult = args;
        }
        if (done.length === currentPos) {
          callback.apply(null, currentResult);
          currentPos = 0;
        }
      };
    }
  };
});

// node_modules/enhanced-resolve/lib/DescriptionFileUtils.js
var require_DescriptionFileUtils = __commonJS((exports) => {
  function loadDescriptionFile(resolver, directory, filenames, resolveContext, callback) {
    (function findDescriptionFile() {
      forEachBail(
        filenames,
        (filename, callback2) => {
          const descriptionFilePath = resolver.join(directory, filename);
          if (resolver.fileSystem.readJson) {
            resolver.fileSystem.readJson(descriptionFilePath, (err, content) => {
              if (err) {
                if (typeof err.code !== "undefined") return callback2();
                return onJson(err);
              }
              onJson(null, content);
            });
          } else {
            resolver.fileSystem.readFile(descriptionFilePath, (err, content) => {
              if (err) return callback2();
              let json;
              try {
                json = JSON.parse(content);
              } catch (e) {
                onJson(e);
              }
              onJson(null, json);
            });
          }
          function onJson(err, content) {
            if (err) {
              if (resolveContext.log) resolveContext.log(descriptionFilePath + " (directory description file): " + err);
              else err.message = descriptionFilePath + " (directory description file): " + err;
              return callback2(err);
            }
            callback2(null, {
              content,
              directory,
              path: descriptionFilePath,
            });
          }
        },
        (err, result) => {
          if (err) return callback(err);
          if (result) {
            return callback(null, result);
          } else {
            directory = cdUp(directory);
            if (!directory) {
              return callback();
            } else {
              return findDescriptionFile();
            }
          }
        }
      );
    })();
  }
  function getField(content, field) {
    if (!content) return;
    if (Array.isArray(field)) {
      let current = content;
      for (let j = 0; j < field.length; j++) {
        if (current === null || typeof current !== "object") {
          current = null;
          break;
        }
        current = current[field[j]];
      }
      if (typeof current === "object") {
        return current;
      }
    } else {
      if (typeof content[field] === "object") {
        return content[field];
      }
    }
  }
  function cdUp(directory) {
    if (directory === "/") return null;
    const i = directory.lastIndexOf("/"),
      j = directory.lastIndexOf("\\");
    const p = i < 0 ? j : j < 0 ? i : i < j ? j : i;
    if (p < 0) return null;
    return directory.substr(0, p || 1);
  }
  var forEachBail = require_forEachBail();
  exports.loadDescriptionFile = loadDescriptionFile;
  exports.getField = getField;
  exports.cdUp = cdUp;
});

// node_modules/enhanced-resolve/lib/DescriptionFilePlugin.js
var require_DescriptionFilePlugin = __commonJS((exports, module) => {
  var DescriptionFileUtils = require_DescriptionFileUtils();
  module.exports = class DescriptionFilePlugin {
    constructor(source, filenames, target) {
      this.source = source;
      this.filenames = [].concat(filenames);
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("DescriptionFilePlugin", (request, resolveContext, callback) => {
        const directory = request.path;
        DescriptionFileUtils.loadDescriptionFile(resolver, directory, this.filenames, resolveContext, (err, result) => {
          if (err) return callback(err);
          if (!result) {
            if (resolveContext.missing) {
              this.filenames.forEach((filename) => {
                resolveContext.missing.add(resolver.join(directory, filename));
              });
            }
            if (resolveContext.log) resolveContext.log("No description file found");
            return callback();
          }
          const relativePath = "." + request.path.substr(result.directory.length).replace(/\\/g, "/");
          const obj = Object.assign({}, request, {
            descriptionFilePath: result.path,
            descriptionFileData: result.content,
            descriptionFileRoot: result.directory,
            relativePath,
          });
          resolver.doResolve(
            target,
            obj,
            "using description file: " + result.path + " (relative path: " + relativePath + ")",
            resolveContext,
            (err2, result2) => {
              if (err2) return callback(err2);
              if (result2 === undefined) return callback(null, null);
              callback(null, result2);
            }
          );
        });
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/NextPlugin.js
var require_NextPlugin = __commonJS((exports, module) => {
  module.exports = class NextPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("NextPlugin", (request, resolveContext, callback) => {
        resolver.doResolve(target, request, null, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/TryNextPlugin.js
var require_TryNextPlugin = __commonJS((exports, module) => {
  module.exports = class TryNextPlugin {
    constructor(source, message, target) {
      this.source = source;
      this.message = message;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("TryNextPlugin", (request, resolveContext, callback) => {
        resolver.doResolve(target, request, this.message, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/ModuleKindPlugin.js
var require_ModuleKindPlugin = __commonJS((exports, module) => {
  module.exports = class ModuleKindPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ModuleKindPlugin", (request, resolveContext, callback) => {
        if (!request.module) return callback();
        const obj = Object.assign({}, request);
        delete obj.module;
        resolver.doResolve(target, obj, "resolve as module", resolveContext, (err, result) => {
          if (err) return callback(err);
          if (result === undefined) return callback(null, null);
          callback(null, result);
        });
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/FileKindPlugin.js
var require_FileKindPlugin = __commonJS((exports, module) => {
  module.exports = class FileKindPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("FileKindPlugin", (request, resolveContext, callback) => {
        if (request.directory) return callback();
        const obj = Object.assign({}, request);
        delete obj.directory;
        resolver.doResolve(target, obj, null, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/JoinRequestPlugin.js
var require_JoinRequestPlugin = __commonJS((exports, module) => {
  module.exports = class JoinRequestPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("JoinRequestPlugin", (request, resolveContext, callback) => {
        const obj = Object.assign({}, request, {
          path: resolver.join(request.path, request.request),
          relativePath: request.relativePath && resolver.join(request.relativePath, request.request),
          request: undefined,
        });
        resolver.doResolve(target, obj, null, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/getPaths.js
var require_getPaths = __commonJS((exports, module) => {
  module.exports = function getPaths(path) {
    const parts = path.split(/(.*?[\\/]+)/);
    const paths = [path];
    const seqments = [parts[parts.length - 1]];
    let part = parts[parts.length - 1];
    path = path.substr(0, path.length - part.length - 1);
    for (let i = parts.length - 2; i > 2; i -= 2) {
      paths.push(path);
      part = parts[i];
      path = path.substr(0, path.length - part.length) || "/";
      seqments.push(part.substr(0, part.length - 1));
    }
    part = parts[1];
    seqments.push(part);
    paths.push(part);
    return {
      paths,
      seqments,
    };
  };
  module.exports.basename = function basename(path) {
    const i = path.lastIndexOf("/"),
      j = path.lastIndexOf("\\");
    const p = i < 0 ? j : j < 0 ? i : i < j ? j : i;
    if (p < 0) return null;
    const s = path.substr(p + 1);
    return s;
  };
});

// node_modules/enhanced-resolve/lib/ModulesInHierachicDirectoriesPlugin.js
var require_ModulesInHierachicDirectoriesPlugin = __commonJS((exports, module) => {
  var forEachBail = require_forEachBail();
  var getPaths = require_getPaths();
  module.exports = class ModulesInHierachicDirectoriesPlugin {
    constructor(source, directories, target) {
      this.source = source;
      this.directories = [].concat(directories);
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver
        .getHook(this.source)
        .tapAsync("ModulesInHierachicDirectoriesPlugin", (request, resolveContext, callback) => {
          const fs = resolver.fileSystem;
          const addrs = getPaths(request.path)
            .paths.map((p) => {
              return this.directories.map((d) => resolver.join(p, d));
            })
            .reduce((array, p) => {
              array.push.apply(array, p);
              return array;
            }, []);
          forEachBail(
            addrs,
            (addr, callback2) => {
              fs.stat(addr, (err, stat) => {
                if (!err && stat && stat.isDirectory()) {
                  const obj = Object.assign({}, request, {
                    path: addr,
                    request: "./" + request.request,
                  });
                  const message = "looking for modules in " + addr;
                  return resolver.doResolve(target, obj, message, resolveContext, callback2);
                }
                if (resolveContext.log) resolveContext.log(addr + " doesn't exist or is not a directory");
                if (resolveContext.missing) resolveContext.missing.add(addr);
                return callback2();
              });
            },
            callback
          );
        });
    }
  };
});

// node_modules/enhanced-resolve/lib/ModulesInRootPlugin.js
var require_ModulesInRootPlugin = __commonJS((exports, module) => {
  module.exports = class ModulesInRootPlugin {
    constructor(source, path, target) {
      this.source = source;
      this.path = path;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ModulesInRootPlugin", (request, resolveContext, callback) => {
        const obj = Object.assign({}, request, {
          path: this.path,
          request: "./" + request.request,
        });
        resolver.doResolve(target, obj, "looking for modules in " + this.path, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/AliasPlugin.js
var require_AliasPlugin = __commonJS((exports, module) => {
  function startsWith(string, searchString) {
    const stringLength = string.length;
    const searchLength = searchString.length;
    if (searchLength > stringLength) {
      return false;
    }
    let index = -1;
    while (++index < searchLength) {
      if (string.charCodeAt(index) !== searchString.charCodeAt(index)) {
        return false;
      }
    }
    return true;
  }
  module.exports = class AliasPlugin {
    constructor(source, options, target) {
      this.source = source;
      this.options = Array.isArray(options) ? options : [options];
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("AliasPlugin", (request, resolveContext, callback) => {
        const innerRequest = request.request || request.path;
        if (!innerRequest) return callback();
        for (const item of this.options) {
          if (innerRequest === item.name || (!item.onlyModule && startsWith(innerRequest, item.name + "/"))) {
            if (innerRequest !== item.alias && !startsWith(innerRequest, item.alias + "/")) {
              const newRequestStr = item.alias + innerRequest.substr(item.name.length);
              const obj = Object.assign({}, request, {
                request: newRequestStr,
              });
              return resolver.doResolve(
                target,
                obj,
                "aliased with mapping '" + item.name + "': '" + item.alias + "' to '" + newRequestStr + "'",
                resolveContext,
                (err, result) => {
                  if (err) return callback(err);
                  if (result === undefined) return callback(null, null);
                  callback(null, result);
                }
              );
            }
          }
        }
        return callback();
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/getInnerRequest.js
var require_getInnerRequest = __commonJS((exports, module) => {
  module.exports = function getInnerRequest(resolver, request) {
    if (
      typeof request.__innerRequest === "string" &&
      request.__innerRequest_request === request.request &&
      request.__innerRequest_relativePath === request.relativePath
    )
      return request.__innerRequest;
    let innerRequest;
    if (request.request) {
      innerRequest = request.request;
      if (/^\.\.?\//.test(innerRequest) && request.relativePath) {
        innerRequest = resolver.join(request.relativePath, innerRequest);
      }
    } else {
      innerRequest = request.relativePath;
    }
    request.__innerRequest_request = request.request;
    request.__innerRequest_relativePath = request.relativePath;
    return (request.__innerRequest = innerRequest);
  };
});

// node_modules/enhanced-resolve/lib/AliasFieldPlugin.js
var require_AliasFieldPlugin = __commonJS((exports, module) => {
  var DescriptionFileUtils = require_DescriptionFileUtils();
  var getInnerRequest = require_getInnerRequest();
  module.exports = class AliasFieldPlugin {
    constructor(source, field, target) {
      this.source = source;
      this.field = field;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("AliasFieldPlugin", (request, resolveContext, callback) => {
        if (!request.descriptionFileData) return callback();
        const innerRequest = getInnerRequest(resolver, request);
        if (!innerRequest) return callback();
        const fieldData = DescriptionFileUtils.getField(request.descriptionFileData, this.field);
        if (typeof fieldData !== "object") {
          if (resolveContext.log)
            resolveContext.log("Field '" + this.field + "' doesn't contain a valid alias configuration");
          return callback();
        }
        const data1 = fieldData[innerRequest];
        const data2 = fieldData[innerRequest.replace(/^\.\//, "")];
        const data = typeof data1 !== "undefined" ? data1 : data2;
        if (data === innerRequest) return callback();
        if (data === undefined) return callback();
        if (data === false) {
          const ignoreObj = Object.assign({}, request, {
            path: false,
          });
          return callback(null, ignoreObj);
        }
        const obj = Object.assign({}, request, {
          path: request.descriptionFileRoot,
          request: data,
        });
        resolver.doResolve(
          target,
          obj,
          "aliased from description file " +
            request.descriptionFilePath +
            " with mapping '" +
            innerRequest +
            "' to '" +
            data +
            "'",
          resolveContext,
          (err, result) => {
            if (err) return callback(err);
            if (result === undefined) return callback(null, null);
            callback(null, result);
          }
        );
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/globToRegExp.js
var require_globToRegExp = __commonJS((exports) => {
  function globToRegExp(glob) {
    if (/^\(.+\)$/.test(glob)) {
      return new RegExp(glob.substr(1, glob.length - 2));
    }
    const tokens = tokenize(glob);
    const process2 = createRoot();
    const regExpStr = tokens.map(process2).join("");
    return new RegExp("^" + regExpStr + "$");
  }
  function tokenize(glob) {
    return glob
      .split(/([@?+*]\(|\/\*\*\/|\*\*|[?*]|\[[!^]?(?:[^\]\\]|\\.)+\]|\{|,|\/|[|)}])/g)
      .map((item) => {
        if (!item) return null;
        const t = SIMPLE_TOKENS[item];
        if (t) {
          return {
            type: t,
          };
        }
        if (item[0] === "[") {
          if (item[1] === "^" || item[1] === "!") {
            return {
              type: "inverted-char-set",
              value: item.substr(2, item.length - 3),
            };
          } else {
            return {
              type: "char-set",
              value: item.substr(1, item.length - 2),
            };
          }
        }
        return {
          type: "string",
          value: item,
        };
      })
      .filter(Boolean)
      .concat({
        type: "end",
      });
  }
  function createRoot() {
    const inOr = [];
    const process2 = createSeqment();
    let initial = true;
    return function (token) {
      switch (token.type) {
        case "or":
          inOr.push(initial);
          return "(";
        case "comma":
          if (inOr.length) {
            initial = inOr[inOr.length - 1];
            return "|";
          } else {
            return process2(
              {
                type: "string",
                value: ",",
              },
              initial
            );
          }
        case "closing-or":
          if (inOr.length === 0) throw new Error("Unmatched '}'");
          inOr.pop();
          return ")";
        case "end":
          if (inOr.length) throw new Error("Unmatched '{'");
          return process2(token, initial);
        default: {
          const result = process2(token, initial);
          initial = false;
          return result;
        }
      }
    };
  }
  function createSeqment() {
    const inSeqment = [];
    const process2 = createSimple();
    return function (token, initial) {
      switch (token.type) {
        case "one":
        case "one-many":
        case "zero-many":
        case "zero-one":
          inSeqment.push(token.type);
          return "(";
        case "segment-sep":
          if (inSeqment.length) {
            return "|";
          } else {
            return process2(
              {
                type: "string",
                value: "|",
              },
              initial
            );
          }
        case "closing-segment": {
          const segment = inSeqment.pop();
          switch (segment) {
            case "one":
              return ")";
            case "one-many":
              return ")+";
            case "zero-many":
              return ")*";
            case "zero-one":
              return ")?";
          }
          throw new Error("Unexcepted segment " + segment);
        }
        case "end":
          if (inSeqment.length > 0) {
            throw new Error("Unmatched segment, missing ')'");
          }
          return process2(token, initial);
        default:
          return process2(token, initial);
      }
    };
  }
  function createSimple() {
    return function (token, initial) {
      switch (token.type) {
        case "path-sep":
          return "[\\\\/]+";
        case "any-path-segments":
          return "[\\\\/]+(?:(.+)[\\\\/]+)?";
        case "any-path":
          return "(.*)";
        case "any-path-segment":
          if (initial) {
            return "\\.[\\\\/]+(?:.*[\\\\/]+)?([^\\\\/]+)";
          } else {
            return "([^\\\\/]*)";
          }
        case "any-char":
          return "[^\\\\/]";
        case "inverted-char-set":
          return "[^" + token.value + "]";
        case "char-set":
          return "[" + token.value + "]";
        case "string":
          return token.value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        case "end":
          return "";
        default:
          throw new Error("Unsupported token '" + token.type + "'");
      }
    };
  }
  var SIMPLE_TOKENS = {
    "@(": "one",
    "?(": "zero-one",
    "+(": "one-many",
    "*(": "zero-many",
    "|": "segment-sep",
    "/**/": "any-path-segments",
    "**": "any-path",
    "*": "any-path-segment",
    "?": "any-char",
    "{": "or",
    "/": "path-sep",
    ",": "comma",
    ")": "closing-segment",
    "}": "closing-or",
  };
  exports.globToRegExp = globToRegExp;
});

// node_modules/enhanced-resolve/lib/concord.js
var require_concord = __commonJS((exports) => {
  function parseType(type) {
    const items = type.split("+");
    const t = items.shift();
    return {
      type: t === "*" ? null : t,
      features: items,
    };
  }
  function isTypeMatched(baseType, testedType) {
    if (typeof baseType === "string") baseType = parseType(baseType);
    if (typeof testedType === "string") testedType = parseType(testedType);
    if (testedType.type && testedType.type !== baseType.type) return false;
    return testedType.features.every((requiredFeature) => {
      return baseType.features.indexOf(requiredFeature) >= 0;
    });
  }
  function isResourceTypeMatched(baseType, testedType) {
    baseType = baseType.split("/");
    testedType = testedType.split("/");
    if (baseType.length !== testedType.length) return false;
    for (let i = 0; i < baseType.length; i++) {
      if (!isTypeMatched(baseType[i], testedType[i])) return false;
    }
    return true;
  }
  function isResourceTypeSupported(context, type) {
    return (
      context.supportedResourceTypes &&
      context.supportedResourceTypes.some((supportedType) => {
        return isResourceTypeMatched(supportedType, type);
      })
    );
  }
  function isEnvironment(context, env) {
    return (
      context.environments &&
      context.environments.every((environment) => {
        return isTypeMatched(environment, env);
      })
    );
  }
  function getGlobRegExp(glob) {
    const regExp = globCache[glob] || (globCache[glob] = globToRegExp(glob));
    return regExp;
  }
  function matchGlob(glob, relativePath) {
    const regExp = getGlobRegExp(glob);
    return regExp.exec(relativePath);
  }
  function isGlobMatched(glob, relativePath) {
    return !!matchGlob(glob, relativePath);
  }
  function isConditionMatched(context, condition) {
    const items = condition.split("|");
    return items.some(function testFn(item) {
      item = item.trim();
      const inverted = /^!/.test(item);
      if (inverted) return !testFn(item.substr(1));
      if (/^[a-z]+:/.test(item)) {
        const match = /^([a-z]+):\s*/.exec(item);
        const value = item.substr(match[0].length);
        const name = match[1];
        switch (name) {
          case "referrer":
            return isGlobMatched(value, context.referrer);
          default:
            return false;
        }
      } else if (item.indexOf("/") >= 0) {
        return isResourceTypeSupported(context, item);
      } else {
        return isEnvironment(context, item);
      }
    });
  }
  function isKeyMatched(context, key) {
    for (;;) {
      const match = /^\[([^\]]+)\]\s*/.exec(key);
      if (!match) return key;
      key = key.substr(match[0].length);
      const condition = match[1];
      if (!isConditionMatched(context, condition)) {
        return false;
      }
    }
  }
  function getField(context, configuration, field) {
    let value;
    Object.keys(configuration).forEach((key) => {
      const pureKey = isKeyMatched(context, key);
      if (pureKey === field) {
        value = configuration[key];
      }
    });
    return value;
  }
  function getMain(context, configuration) {
    return getField(context, configuration, "main");
  }
  function getExtensions(context, configuration) {
    return getField(context, configuration, "extensions");
  }
  function matchModule(context, configuration, request) {
    const modulesField = getField(context, configuration, "modules");
    if (!modulesField) return request;
    let newRequest = request;
    const keys = Object.keys(modulesField);
    let iteration = 0;
    let match;
    let index;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const pureKey = isKeyMatched(context, key);
      match = matchGlob(pureKey, newRequest);
      if (match) {
        const value = modulesField[key];
        if (typeof value !== "string") {
          return value;
        } else if (/^\(.+\)$/.test(pureKey)) {
          newRequest = newRequest.replace(getGlobRegExp(pureKey), value);
        } else {
          index = 1;
          newRequest = value.replace(/(\/?\*)?\*/g, replaceMatcher);
        }
        i = -1;
        if (iteration++ > keys.length) {
          throw new Error("Request '" + request + "' matches recursively");
        }
      }
    }
    return newRequest;
    function replaceMatcher(find) {
      switch (find) {
        case "/**": {
          const m = match[index++];
          return m ? "/" + m : "";
        }
        case "**":
        case "*":
          return match[index++];
      }
    }
  }
  function matchType(context, configuration, relativePath) {
    const typesField = getField(context, configuration, "types");
    if (!typesField) return;
    let type;
    Object.keys(typesField).forEach((key) => {
      const pureKey = isKeyMatched(context, key);
      if (isGlobMatched(pureKey, relativePath)) {
        const value = typesField[key];
        if (!type && /\/\*$/.test(value))
          throw new Error(
            "value ('" + value + "') of key '" + key + "' contains '*', but there is no previous value defined"
          );
        type = value.replace(/\/\*$/, "/" + type);
      }
    });
    return type;
  }
  var globToRegExp = require_globToRegExp().globToRegExp;
  var globCache = {};
  exports.parseType = parseType;
  exports.isTypeMatched = isTypeMatched;
  exports.isResourceTypeSupported = isResourceTypeSupported;
  exports.isEnvironment = isEnvironment;
  exports.isGlobMatched = isGlobMatched;
  exports.isConditionMatched = isConditionMatched;
  exports.isKeyMatched = isKeyMatched;
  exports.getField = getField;
  exports.getMain = getMain;
  exports.getExtensions = getExtensions;
  exports.matchModule = matchModule;
  exports.matchType = matchType;
});

// node_modules/enhanced-resolve/lib/ConcordExtensionsPlugin.js
var require_ConcordExtensionsPlugin = __commonJS((exports, module) => {
  var concord = require_concord();
  var DescriptionFileUtils = require_DescriptionFileUtils();
  var forEachBail = require_forEachBail();
  module.exports = class ConcordExtensionsPlugin {
    constructor(source, options, target) {
      this.source = source;
      this.options = options;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ConcordExtensionsPlugin", (request, resolveContext, callback) => {
        const concordField = DescriptionFileUtils.getField(request.descriptionFileData, "concord");
        if (!concordField) return callback();
        const extensions = concord.getExtensions(request.context, concordField);
        if (!extensions) return callback();
        forEachBail(
          extensions,
          (appending, callback2) => {
            const obj = Object.assign({}, request, {
              path: request.path + appending,
              relativePath: request.relativePath && request.relativePath + appending,
            });
            resolver.doResolve(target, obj, "concord extension: " + appending, resolveContext, callback2);
          },
          (err, result) => {
            if (err) return callback(err);
            if (result === undefined) return callback(null, null);
            callback(null, result);
          }
        );
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/ConcordMainPlugin.js
var require_ConcordMainPlugin = __commonJS((exports, module) => {
  var path = __require("path");
  var concord = require_concord();
  var DescriptionFileUtils = require_DescriptionFileUtils();
  module.exports = class ConcordMainPlugin {
    constructor(source, options, target) {
      this.source = source;
      this.options = options;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ConcordMainPlugin", (request, resolveContext, callback) => {
        if (request.path !== request.descriptionFileRoot) return callback();
        const concordField = DescriptionFileUtils.getField(request.descriptionFileData, "concord");
        if (!concordField) return callback();
        const mainModule = concord.getMain(request.context, concordField);
        if (!mainModule) return callback();
        const obj = Object.assign({}, request, {
          request: mainModule,
        });
        const filename = path.basename(request.descriptionFilePath);
        return resolver.doResolve(target, obj, "use " + mainModule + " from " + filename, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/ConcordModulesPlugin.js
var require_ConcordModulesPlugin = __commonJS((exports, module) => {
  var concord = require_concord();
  var DescriptionFileUtils = require_DescriptionFileUtils();
  var getInnerRequest = require_getInnerRequest();
  module.exports = class ConcordModulesPlugin {
    constructor(source, options, target) {
      this.source = source;
      this.options = options;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ConcordModulesPlugin", (request, resolveContext, callback) => {
        const innerRequest = getInnerRequest(resolver, request);
        if (!innerRequest) return callback();
        const concordField = DescriptionFileUtils.getField(request.descriptionFileData, "concord");
        if (!concordField) return callback();
        const data = concord.matchModule(request.context, concordField, innerRequest);
        if (data === innerRequest) return callback();
        if (data === undefined) return callback();
        if (data === false) {
          const ignoreObj = Object.assign({}, request, {
            path: false,
          });
          return callback(null, ignoreObj);
        }
        const obj = Object.assign({}, request, {
          path: request.descriptionFileRoot,
          request: data,
        });
        resolver.doResolve(
          target,
          obj,
          "aliased from description file " +
            request.descriptionFilePath +
            " with mapping '" +
            innerRequest +
            "' to '" +
            data +
            "'",
          resolveContext,
          (err, result) => {
            if (err) return callback(err);
            if (result === undefined) return callback(null, null);
            callback(null, result);
          }
        );
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/DirectoryExistsPlugin.js
var require_DirectoryExistsPlugin = __commonJS((exports, module) => {
  module.exports = class DirectoryExistsPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("DirectoryExistsPlugin", (request, resolveContext, callback) => {
        const fs = resolver.fileSystem;
        const directory = request.path;
        fs.stat(directory, (err, stat) => {
          if (err || !stat) {
            if (resolveContext.missing) resolveContext.missing.add(directory);
            if (resolveContext.log) resolveContext.log(directory + " doesn't exist");
            return callback();
          }
          if (!stat.isDirectory()) {
            if (resolveContext.missing) resolveContext.missing.add(directory);
            if (resolveContext.log) resolveContext.log(directory + " is not a directory");
            return callback();
          }
          resolver.doResolve(target, request, "existing directory", resolveContext, callback);
        });
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/FileExistsPlugin.js
var require_FileExistsPlugin = __commonJS((exports, module) => {
  module.exports = class FileExistsPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      const fs = resolver.fileSystem;
      resolver.getHook(this.source).tapAsync("FileExistsPlugin", (request, resolveContext, callback) => {
        const file = request.path;
        fs.stat(file, (err, stat) => {
          if (err || !stat) {
            if (resolveContext.missing) resolveContext.missing.add(file);
            if (resolveContext.log) resolveContext.log(file + " doesn't exist");
            return callback();
          }
          if (!stat.isFile()) {
            if (resolveContext.missing) resolveContext.missing.add(file);
            if (resolveContext.log) resolveContext.log(file + " is not a file");
            return callback();
          }
          resolver.doResolve(target, request, "existing file: " + file, resolveContext, callback);
        });
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/SymlinkPlugin.js
var require_SymlinkPlugin = __commonJS((exports, module) => {
  var getPaths = require_getPaths();
  var forEachBail = require_forEachBail();
  module.exports = class SymlinkPlugin {
    constructor(source, target) {
      this.source = source;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      const fs = resolver.fileSystem;
      resolver.getHook(this.source).tapAsync("SymlinkPlugin", (request, resolveContext, callback) => {
        const pathsResult = getPaths(request.path);
        const pathSeqments = pathsResult.seqments;
        const paths = pathsResult.paths;
        let containsSymlink = false;
        forEachBail.withIndex(
          paths,
          (path, idx, callback2) => {
            fs.readlink(path, (err, result) => {
              if (!err && result) {
                pathSeqments[idx] = result;
                containsSymlink = true;
                if (/^(\/|[a-zA-Z]:($|\\))/.test(result)) return callback2(null, idx);
              }
              callback2();
            });
          },
          (err, idx) => {
            if (!containsSymlink) return callback();
            const resultSeqments = typeof idx === "number" ? pathSeqments.slice(0, idx + 1) : pathSeqments.slice();
            const result = resultSeqments.reverse().reduce((a, b) => {
              return resolver.join(a, b);
            });
            const obj = Object.assign({}, request, {
              path: result,
            });
            resolver.doResolve(target, obj, "resolved symlink to " + result, resolveContext, callback);
          }
        );
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/MainFieldPlugin.js
var require_MainFieldPlugin = __commonJS((exports, module) => {
  var path = __require("path");
  module.exports = class MainFieldPlugin {
    constructor(source, options, target) {
      this.source = source;
      this.options = options;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("MainFieldPlugin", (request, resolveContext, callback) => {
        if (request.path !== request.descriptionFileRoot) return callback();
        if (request.alreadyTriedMainField === request.descriptionFilePath) return callback();
        const content = request.descriptionFileData;
        const filename = path.basename(request.descriptionFilePath);
        let mainModule;
        const field = this.options.name;
        if (Array.isArray(field)) {
          let current = content;
          for (let j = 0; j < field.length; j++) {
            if (current === null || typeof current !== "object") {
              current = null;
              break;
            }
            current = current[field[j]];
          }
          if (typeof current === "string") {
            mainModule = current;
          }
        } else {
          if (typeof content[field] === "string") {
            mainModule = content[field];
          }
        }
        if (!mainModule) return callback();
        if (this.options.forceRelative && !/^\.\.?\//.test(mainModule)) mainModule = "./" + mainModule;
        const obj = Object.assign({}, request, {
          request: mainModule,
          alreadyTriedMainField: request.descriptionFilePath,
        });
        return resolver.doResolve(
          target,
          obj,
          "use " + mainModule + " from " + this.options.name + " in " + filename,
          resolveContext,
          callback
        );
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/UseFilePlugin.js
var require_UseFilePlugin = __commonJS((exports, module) => {
  module.exports = class UseFilePlugin {
    constructor(source, filename, target) {
      this.source = source;
      this.filename = filename;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("UseFilePlugin", (request, resolveContext, callback) => {
        const filePath = resolver.join(request.path, this.filename);
        const obj = Object.assign({}, request, {
          path: filePath,
          relativePath: request.relativePath && resolver.join(request.relativePath, this.filename),
        });
        resolver.doResolve(target, obj, "using path: " + filePath, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/AppendPlugin.js
var require_AppendPlugin = __commonJS((exports, module) => {
  module.exports = class AppendPlugin {
    constructor(source, appending, target) {
      this.source = source;
      this.appending = appending;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("AppendPlugin", (request, resolveContext, callback) => {
        const obj = Object.assign({}, request, {
          path: request.path + this.appending,
          relativePath: request.relativePath && request.relativePath + this.appending,
        });
        resolver.doResolve(target, obj, this.appending, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/RootPlugin.js
var require_RootPlugin = __commonJS((exports, module) => {
  class RootPlugin {
    constructor(source, root, target, ignoreErrors) {
      this.root = root;
      this.source = source;
      this.target = target;
      this._ignoreErrors = ignoreErrors;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("RootPlugin", (request, resolveContext, callback) => {
        const req = request.request;
        if (!req) return callback();
        if (!req.startsWith("/")) return callback();
        const path = resolver.join(this.root, req.slice(1));
        const obj = Object.assign(request, {
          path,
          relativePath: request.relativePath && path,
        });
        resolver.doResolve(
          target,
          obj,
          `root path ${this.root}`,
          resolveContext,
          this._ignoreErrors
            ? (err, result) => {
                if (err) {
                  if (resolveContext.log) {
                    resolveContext.log(`Ignored fatal error while resolving root path:\n${err}`);
                  }
                  return callback();
                }
                if (result) return callback(null, result);
                callback();
              }
            : callback
        );
      });
    }
  }
  module.exports = RootPlugin;
});

// node_modules/enhanced-resolve/lib/RestrictionsPlugin.js
var require_RestrictionsPlugin = __commonJS((exports, module) => {
  var slashCode = "/".charCodeAt(0);
  var backslashCode = "\\".charCodeAt(0);
  var isInside = (path, parent) => {
    if (!path.startsWith(parent)) return false;
    if (path.length === parent.length) return true;
    const charCode = path.charCodeAt(parent.length);
    return charCode === slashCode || charCode === backslashCode;
  };
  module.exports = class RestrictionsPlugin {
    constructor(source, restrictions) {
      this.source = source;
      this.restrictions = restrictions;
    }
    apply(resolver) {
      resolver.getHook(this.source).tapAsync("RestrictionsPlugin", (request, resolveContext, callback) => {
        if (typeof request.path === "string") {
          const path = request.path;
          for (let i = 0; i < this.restrictions.length; i++) {
            const rule = this.restrictions[i];
            if (typeof rule === "string") {
              if (!isInside(path, rule)) {
                if (resolveContext.log) {
                  resolveContext.log(`${path} is not inside of the restriction ${rule}`);
                }
                return callback(null, null);
              }
            } else if (!rule.test(path)) {
              if (resolveContext.log) {
                resolveContext.log(`${path} doesn't match the restriction ${rule}`);
              }
              return callback(null, null);
            }
          }
        }
        callback();
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/ResultPlugin.js
var require_ResultPlugin = __commonJS((exports, module) => {
  module.exports = class ResultPlugin {
    constructor(source) {
      this.source = source;
    }
    apply(resolver) {
      this.source.tapAsync("ResultPlugin", (request, resolverContext, callback) => {
        const obj = Object.assign({}, request);
        if (resolverContext.log) resolverContext.log("reporting result " + obj.path);
        resolver.hooks.result.callAsync(obj, resolverContext, (err) => {
          if (err) return callback(err);
          callback(null, obj);
        });
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/ModuleAppendPlugin.js
var require_ModuleAppendPlugin = __commonJS((exports, module) => {
  module.exports = class ModuleAppendPlugin {
    constructor(source, appending, target) {
      this.source = source;
      this.appending = appending;
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("ModuleAppendPlugin", (request, resolveContext, callback) => {
        const i = request.request.indexOf("/"),
          j = request.request.indexOf("\\");
        const p = i < 0 ? j : j < 0 ? i : i < j ? i : j;
        let moduleName, remainingRequest;
        if (p < 0) {
          moduleName = request.request;
          remainingRequest = "";
        } else {
          moduleName = request.request.substr(0, p);
          remainingRequest = request.request.substr(p);
        }
        if (moduleName === "." || moduleName === "..") return callback();
        const moduleFinalName = moduleName + this.appending;
        const obj = Object.assign({}, request, {
          request: moduleFinalName + remainingRequest,
        });
        resolver.doResolve(target, obj, "module variation " + moduleFinalName, resolveContext, callback);
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/UnsafeCachePlugin.js
var require_UnsafeCachePlugin = __commonJS((exports, module) => {
  function getCacheId(request, withContext) {
    return JSON.stringify({
      context: withContext ? request.context : "",
      path: request.path,
      query: request.query,
      request: request.request,
    });
  }
  module.exports = class UnsafeCachePlugin {
    constructor(source, filterPredicate, cache, withContext, target) {
      this.source = source;
      this.filterPredicate = filterPredicate;
      this.withContext = withContext;
      this.cache = cache || {};
      this.target = target;
    }
    apply(resolver) {
      const target = resolver.ensureHook(this.target);
      resolver.getHook(this.source).tapAsync("UnsafeCachePlugin", (request, resolveContext, callback) => {
        if (!this.filterPredicate(request)) return callback();
        const cacheId = getCacheId(request, this.withContext);
        const cacheEntry = this.cache[cacheId];
        if (cacheEntry) {
          return callback(null, cacheEntry);
        }
        resolver.doResolve(target, request, null, resolveContext, (err, result) => {
          if (err) return callback(err);
          if (result) return callback(null, (this.cache[cacheId] = result));
          callback();
        });
      });
    }
  };
});

// node_modules/enhanced-resolve/lib/ResolverFactory.js
var require_ResolverFactory = __commonJS((exports) => {
  function mergeFilteredToArray(array, filter) {
    return array.reduce((array2, item) => {
      if (filter(item)) {
        const lastElement = array2[array2.length - 1];
        if (Array.isArray(lastElement)) {
          lastElement.push(item);
        } else {
          array2.push([item]);
        }
        return array2;
      } else {
        array2.push(item);
        return array2;
      }
    }, []);
  }
  function isAbsolutePath(path) {
    return /^[A-Z]:|^\//.test(path);
  }
  var Resolver = require_Resolver();
  var SyncAsyncFileSystemDecorator = require_SyncAsyncFileSystemDecorator();
  var ParsePlugin = require_ParsePlugin();
  var DescriptionFilePlugin = require_DescriptionFilePlugin();
  var NextPlugin = require_NextPlugin();
  var TryNextPlugin = require_TryNextPlugin();
  var ModuleKindPlugin = require_ModuleKindPlugin();
  var FileKindPlugin = require_FileKindPlugin();
  var JoinRequestPlugin = require_JoinRequestPlugin();
  var ModulesInHierachicDirectoriesPlugin = require_ModulesInHierachicDirectoriesPlugin();
  var ModulesInRootPlugin = require_ModulesInRootPlugin();
  var AliasPlugin = require_AliasPlugin();
  var AliasFieldPlugin = require_AliasFieldPlugin();
  var ConcordExtensionsPlugin = require_ConcordExtensionsPlugin();
  var ConcordMainPlugin = require_ConcordMainPlugin();
  var ConcordModulesPlugin = require_ConcordModulesPlugin();
  var DirectoryExistsPlugin = require_DirectoryExistsPlugin();
  var FileExistsPlugin = require_FileExistsPlugin();
  var SymlinkPlugin = require_SymlinkPlugin();
  var MainFieldPlugin = require_MainFieldPlugin();
  var UseFilePlugin = require_UseFilePlugin();
  var AppendPlugin = require_AppendPlugin();
  var RootPlugin = require_RootPlugin();
  var RestrictionsPlugin = require_RestrictionsPlugin();
  var ResultPlugin = require_ResultPlugin();
  var ModuleAppendPlugin = require_ModuleAppendPlugin();
  var UnsafeCachePlugin = require_UnsafeCachePlugin();
  exports.createResolver = function (options) {
    let modules = options.modules || ["node_modules"];
    const descriptionFiles = options.descriptionFiles || ["package.json"];
    const plugins = (options.plugins && options.plugins.slice()) || [];
    let mainFields = options.mainFields || ["main"];
    const aliasFields = options.aliasFields || [];
    const mainFiles = options.mainFiles || ["index"];
    let extensions = options.extensions || [".js", ".json", ".node"];
    const enforceExtension = options.enforceExtension || false;
    let moduleExtensions = options.moduleExtensions || [];
    const enforceModuleExtension = options.enforceModuleExtension || false;
    let alias = options.alias || [];
    const symlinks = typeof options.symlinks !== "undefined" ? options.symlinks : true;
    const resolveToContext = options.resolveToContext || false;
    const roots = options.roots || [];
    const ignoreRootsErrors = options.ignoreRootsErrors || false;
    const preferAbsolute = options.preferAbsolute || false;
    const restrictions = options.restrictions || [];
    let unsafeCache = options.unsafeCache || false;
    const cacheWithContext = typeof options.cacheWithContext !== "undefined" ? options.cacheWithContext : true;
    const enableConcord = options.concord || false;
    const cachePredicate =
      options.cachePredicate ||
      function () {
        return true;
      };
    const fileSystem = options.fileSystem;
    const useSyncFileSystemCalls = options.useSyncFileSystemCalls;
    let resolver = options.resolver;
    if (!resolver) {
      resolver = new Resolver(useSyncFileSystemCalls ? new SyncAsyncFileSystemDecorator(fileSystem) : fileSystem);
    }
    extensions = [].concat(extensions);
    moduleExtensions = [].concat(moduleExtensions);
    modules = mergeFilteredToArray([].concat(modules), (item) => {
      return !isAbsolutePath(item);
    });
    mainFields = mainFields.map((item) => {
      if (typeof item === "string" || Array.isArray(item)) {
        item = {
          name: item,
          forceRelative: true,
        };
      }
      return item;
    });
    if (typeof alias === "object" && !Array.isArray(alias)) {
      alias = Object.keys(alias).map((key) => {
        let onlyModule = false;
        let obj = alias[key];
        if (/\$$/.test(key)) {
          onlyModule = true;
          key = key.substr(0, key.length - 1);
        }
        if (typeof obj === "string") {
          obj = {
            alias: obj,
          };
        }
        obj = Object.assign(
          {
            name: key,
            onlyModule,
          },
          obj
        );
        return obj;
      });
    }
    if (unsafeCache && typeof unsafeCache !== "object") {
      unsafeCache = {};
    }
    resolver.ensureHook("resolve");
    resolver.ensureHook("parsedResolve");
    resolver.ensureHook("describedResolve");
    resolver.ensureHook("rawModule");
    resolver.ensureHook("module");
    resolver.ensureHook("relative");
    resolver.ensureHook("describedRelative");
    resolver.ensureHook("directory");
    resolver.ensureHook("existingDirectory");
    resolver.ensureHook("undescribedRawFile");
    resolver.ensureHook("rawFile");
    resolver.ensureHook("file");
    resolver.ensureHook("existingFile");
    resolver.ensureHook("resolved");
    if (unsafeCache) {
      plugins.push(new UnsafeCachePlugin("resolve", cachePredicate, unsafeCache, cacheWithContext, "new-resolve"));
      plugins.push(new ParsePlugin("new-resolve", "parsed-resolve"));
    } else {
      plugins.push(new ParsePlugin("resolve", "parsed-resolve"));
    }
    plugins.push(new DescriptionFilePlugin("parsed-resolve", descriptionFiles, "described-resolve"));
    plugins.push(new NextPlugin("after-parsed-resolve", "described-resolve"));
    if (alias.length > 0) plugins.push(new AliasPlugin("described-resolve", alias, "resolve"));
    if (enableConcord) {
      plugins.push(new ConcordModulesPlugin("described-resolve", {}, "resolve"));
    }
    aliasFields.forEach((item) => {
      plugins.push(new AliasFieldPlugin("described-resolve", item, "resolve"));
    });
    plugins.push(new ModuleKindPlugin("after-described-resolve", "raw-module"));
    if (preferAbsolute) {
      plugins.push(new JoinRequestPlugin("after-described-resolve", "relative"));
    }
    roots.forEach((root) => {
      plugins.push(new RootPlugin("after-described-resolve", root, "relative", ignoreRootsErrors));
    });
    if (!preferAbsolute) {
      plugins.push(new JoinRequestPlugin("after-described-resolve", "relative"));
    }
    moduleExtensions.forEach((item) => {
      plugins.push(new ModuleAppendPlugin("raw-module", item, "module"));
    });
    if (!enforceModuleExtension) plugins.push(new TryNextPlugin("raw-module", null, "module"));
    modules.forEach((item) => {
      if (Array.isArray(item)) plugins.push(new ModulesInHierachicDirectoriesPlugin("module", item, "resolve"));
      else plugins.push(new ModulesInRootPlugin("module", item, "resolve"));
    });
    plugins.push(new DescriptionFilePlugin("relative", descriptionFiles, "described-relative"));
    plugins.push(new NextPlugin("after-relative", "described-relative"));
    plugins.push(new FileKindPlugin("described-relative", "raw-file"));
    plugins.push(new TryNextPlugin("described-relative", "as directory", "directory"));
    plugins.push(new DirectoryExistsPlugin("directory", "existing-directory"));
    if (resolveToContext) {
      plugins.push(new NextPlugin("existing-directory", "resolved"));
    } else {
      if (enableConcord) {
        plugins.push(new ConcordMainPlugin("existing-directory", {}, "resolve"));
      }
      mainFields.forEach((item) => {
        plugins.push(new MainFieldPlugin("existing-directory", item, "resolve"));
      });
      mainFiles.forEach((item) => {
        plugins.push(new UseFilePlugin("existing-directory", item, "undescribed-raw-file"));
      });
      plugins.push(new DescriptionFilePlugin("undescribed-raw-file", descriptionFiles, "raw-file"));
      plugins.push(new NextPlugin("after-undescribed-raw-file", "raw-file"));
      if (!enforceExtension) {
        plugins.push(new TryNextPlugin("raw-file", "no extension", "file"));
      }
      if (enableConcord) {
        plugins.push(new ConcordExtensionsPlugin("raw-file", {}, "file"));
      }
      extensions.forEach((item) => {
        plugins.push(new AppendPlugin("raw-file", item, "file"));
      });
      if (alias.length > 0) plugins.push(new AliasPlugin("file", alias, "resolve"));
      if (enableConcord) {
        plugins.push(new ConcordModulesPlugin("file", {}, "resolve"));
      }
      aliasFields.forEach((item) => {
        plugins.push(new AliasFieldPlugin("file", item, "resolve"));
      });
      if (symlinks) plugins.push(new SymlinkPlugin("file", "relative"));
      plugins.push(new FileExistsPlugin("file", "existing-file"));
      plugins.push(new NextPlugin("existing-file", "resolved"));
    }
    if (restrictions.length > 0) {
      plugins.push(new RestrictionsPlugin(resolver.hooks.resolved, restrictions));
    }
    plugins.push(new ResultPlugin(resolver.hooks.resolved));
    plugins.forEach((plugin) => {
      plugin.apply(resolver);
    });
    return resolver;
  };
});

// node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS((exports, module) => {
  function patch(fs) {
    if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
      patchLchmod(fs);
    }
    if (!fs.lutimes) {
      patchLutimes(fs);
    }
    fs.chown = chownFix(fs.chown);
    fs.fchown = chownFix(fs.fchown);
    fs.lchown = chownFix(fs.lchown);
    fs.chmod = chmodFix(fs.chmod);
    fs.fchmod = chmodFix(fs.fchmod);
    fs.lchmod = chmodFix(fs.lchmod);
    fs.chownSync = chownFixSync(fs.chownSync);
    fs.fchownSync = chownFixSync(fs.fchownSync);
    fs.lchownSync = chownFixSync(fs.lchownSync);
    fs.chmodSync = chmodFixSync(fs.chmodSync);
    fs.fchmodSync = chmodFixSync(fs.fchmodSync);
    fs.lchmodSync = chmodFixSync(fs.lchmodSync);
    fs.stat = statFix(fs.stat);
    fs.fstat = statFix(fs.fstat);
    fs.lstat = statFix(fs.lstat);
    fs.statSync = statFixSync(fs.statSync);
    fs.fstatSync = statFixSync(fs.fstatSync);
    fs.lstatSync = statFixSync(fs.lstatSync);
    if (fs.chmod && !fs.lchmod) {
      fs.lchmod = function (path, mode, cb) {
        if (cb) process.nextTick(cb);
      };
      fs.lchmodSync = function () {};
    }
    if (fs.chown && !fs.lchown) {
      fs.lchown = function (path, uid, gid, cb) {
        if (cb) process.nextTick(cb);
      };
      fs.lchownSync = function () {};
    }
    if (platform === "win32") {
      fs.rename =
        typeof fs.rename !== "function"
          ? fs.rename
          : (function (fs$rename) {
              function rename(from, to, cb) {
                var start = Date.now();
                var backoff = 0;
                fs$rename(from, to, function CB(er) {
                  if (
                    er &&
                    (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") &&
                    Date.now() - start < 60000
                  ) {
                    setTimeout(function () {
                      fs.stat(to, function (stater, st) {
                        if (stater && stater.code === "ENOENT") fs$rename(from, to, CB);
                        else cb(er);
                      });
                    }, backoff);
                    if (backoff < 100) backoff += 10;
                    return;
                  }
                  if (cb) cb(er);
                });
              }
              if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
              return rename;
            })(fs.rename);
    }
    fs.read =
      typeof fs.read !== "function"
        ? fs.read
        : (function (fs$read) {
            function read(fd, buffer, offset, length, position, callback_) {
              var callback;
              if (callback_ && typeof callback_ === "function") {
                var eagCounter = 0;
                callback = function (er, _, __) {
                  if (er && er.code === "EAGAIN" && eagCounter < 10) {
                    eagCounter++;
                    return fs$read.call(fs, fd, buffer, offset, length, position, callback);
                  }
                  callback_.apply(this, arguments);
                };
              }
              return fs$read.call(fs, fd, buffer, offset, length, position, callback);
            }
            if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
            return read;
          })(fs.read);
    fs.readSync =
      typeof fs.readSync !== "function"
        ? fs.readSync
        : (function (fs$readSync) {
            return function (fd, buffer, offset, length, position) {
              var eagCounter = 0;
              while (true) {
                try {
                  return fs$readSync.call(fs, fd, buffer, offset, length, position);
                } catch (er) {
                  if (er.code === "EAGAIN" && eagCounter < 10) {
                    eagCounter++;
                    continue;
                  }
                  throw er;
                }
              }
            };
          })(fs.readSync);
    function patchLchmod(fs2) {
      fs2.lchmod = function (path, mode, callback) {
        fs2.open(path, constants.O_WRONLY | constants.O_SYMLINK, mode, function (err, fd) {
          if (err) {
            if (callback) callback(err);
            return;
          }
          fs2.fchmod(fd, mode, function (err2) {
            fs2.close(fd, function (err22) {
              if (callback) callback(err2 || err22);
            });
          });
        });
      };
      fs2.lchmodSync = function (path, mode) {
        var fd = fs2.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
        var threw = true;
        var ret;
        try {
          ret = fs2.fchmodSync(fd, mode);
          threw = false;
        } finally {
          if (threw) {
            try {
              fs2.closeSync(fd);
            } catch (er) {}
          } else {
            fs2.closeSync(fd);
          }
        }
        return ret;
      };
    }
    function patchLutimes(fs2) {
      if (constants.hasOwnProperty("O_SYMLINK") && fs2.futimes) {
        fs2.lutimes = function (path, at, mt, cb) {
          fs2.open(path, constants.O_SYMLINK, function (er, fd) {
            if (er) {
              if (cb) cb(er);
              return;
            }
            fs2.futimes(fd, at, mt, function (er2) {
              fs2.close(fd, function (er22) {
                if (cb) cb(er2 || er22);
              });
            });
          });
        };
        fs2.lutimesSync = function (path, at, mt) {
          var fd = fs2.openSync(path, constants.O_SYMLINK);
          var ret;
          var threw = true;
          try {
            ret = fs2.futimesSync(fd, at, mt);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs2.closeSync(fd);
              } catch (er) {}
            } else {
              fs2.closeSync(fd);
            }
          }
          return ret;
        };
      } else if (fs2.futimes) {
        fs2.lutimes = function (_a, _b, _c, cb) {
          if (cb) process.nextTick(cb);
        };
        fs2.lutimesSync = function () {};
      }
    }
    function chmodFix(orig) {
      if (!orig) return orig;
      return function (target, mode, cb) {
        return orig.call(fs, target, mode, function (er) {
          if (chownErOk(er)) er = null;
          if (cb) cb.apply(this, arguments);
        });
      };
    }
    function chmodFixSync(orig) {
      if (!orig) return orig;
      return function (target, mode) {
        try {
          return orig.call(fs, target, mode);
        } catch (er) {
          if (!chownErOk(er)) throw er;
        }
      };
    }
    function chownFix(orig) {
      if (!orig) return orig;
      return function (target, uid, gid, cb) {
        return orig.call(fs, target, uid, gid, function (er) {
          if (chownErOk(er)) er = null;
          if (cb) cb.apply(this, arguments);
        });
      };
    }
    function chownFixSync(orig) {
      if (!orig) return orig;
      return function (target, uid, gid) {
        try {
          return orig.call(fs, target, uid, gid);
        } catch (er) {
          if (!chownErOk(er)) throw er;
        }
      };
    }
    function statFix(orig) {
      if (!orig) return orig;
      return function (target, options, cb) {
        if (typeof options === "function") {
          cb = options;
          options = null;
        }
        function callback(er, stats) {
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          if (cb) cb.apply(this, arguments);
        }
        return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
      };
    }
    function statFixSync(orig) {
      if (!orig) return orig;
      return function (target, options) {
        var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
        if (stats) {
          if (stats.uid < 0) stats.uid += 4294967296;
          if (stats.gid < 0) stats.gid += 4294967296;
        }
        return stats;
      };
    }
    function chownErOk(er) {
      if (!er) return true;
      if (er.code === "ENOSYS") return true;
      var nonroot = !process.getuid || process.getuid() !== 0;
      if (nonroot) {
        if (er.code === "EINVAL" || er.code === "EPERM") return true;
      }
      return false;
    }
  }
  var constants = __require("constants");
  var origCwd = process.cwd;
  var cwd = null;
  var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
  process.cwd = function () {
    if (!cwd) cwd = origCwd.call(process);
    return cwd;
  };
  try {
    process.cwd();
  } catch (er) {}
  if (typeof process.chdir === "function") {
    chdir = process.chdir;
    process.chdir = function (d) {
      cwd = null;
      chdir.call(process, d);
    };
    if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
  }
  var chdir;
  module.exports = patch;
});

// node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS((exports, module) => {
  function legacy(fs) {
    return {
      ReadStream,
      WriteStream,
    };
    function ReadStream(path, options) {
      if (!(this instanceof ReadStream)) return new ReadStream(path, options);
      Stream.call(this);
      var self = this;
      this.path = path;
      this.fd = null;
      this.readable = true;
      this.paused = false;
      this.flags = "r";
      this.mode = 438;
      this.bufferSize = 64 * 1024;
      options = options || {};
      var keys = Object.keys(options);
      for (var index = 0, length = keys.length; index < length; index++) {
        var key = keys[index];
        this[key] = options[key];
      }
      if (this.encoding) this.setEncoding(this.encoding);
      if (this.start !== undefined) {
        if (typeof this.start !== "number") {
          throw TypeError("start must be a Number");
        }
        if (this.end === undefined) {
          this.end = Infinity;
        } else if (typeof this.end !== "number") {
          throw TypeError("end must be a Number");
        }
        if (this.start > this.end) {
          throw new Error("start must be <= end");
        }
        this.pos = this.start;
      }
      if (this.fd !== null) {
        process.nextTick(function () {
          self._read();
        });
        return;
      }
      fs.open(this.path, this.flags, this.mode, function (err, fd) {
        if (err) {
          self.emit("error", err);
          self.readable = false;
          return;
        }
        self.fd = fd;
        self.emit("open", fd);
        self._read();
      });
    }
    function WriteStream(path, options) {
      if (!(this instanceof WriteStream)) return new WriteStream(path, options);
      Stream.call(this);
      this.path = path;
      this.fd = null;
      this.writable = true;
      this.flags = "w";
      this.encoding = "binary";
      this.mode = 438;
      this.bytesWritten = 0;
      options = options || {};
      var keys = Object.keys(options);
      for (var index = 0, length = keys.length; index < length; index++) {
        var key = keys[index];
        this[key] = options[key];
      }
      if (this.start !== undefined) {
        if (typeof this.start !== "number") {
          throw TypeError("start must be a Number");
        }
        if (this.start < 0) {
          throw new Error("start must be >= zero");
        }
        this.pos = this.start;
      }
      this.busy = false;
      this._queue = [];
      if (this.fd === null) {
        this._open = fs.open;
        this._queue.push([this._open, this.path, this.flags, this.mode, undefined]);
        this.flush();
      }
    }
  }
  var Stream = __require("stream").Stream;
  module.exports = legacy;
});

// node_modules/graceful-fs/clone.js
var require_clone = __commonJS((exports, module) => {
  function clone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Object) var copy = { __proto__: getPrototypeOf(obj) };
    else var copy = Object.create(null);
    Object.getOwnPropertyNames(obj).forEach(function (key) {
      Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
    });
    return copy;
  }
  module.exports = clone;
  var getPrototypeOf =
    Object.getPrototypeOf ||
    function (obj) {
      return obj.__proto__;
    };
});

// node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS((exports, module) => {
  function noop() {}
  function publishQueue(context, queue2) {
    Object.defineProperty(context, gracefulQueue, {
      get: function () {
        return queue2;
      },
    });
  }
  function patch(fs2) {
    polyfills(fs2);
    fs2.gracefulify = patch;
    fs2.createReadStream = createReadStream;
    fs2.createWriteStream = createWriteStream;
    var fs$readFile = fs2.readFile;
    fs2.readFile = readFile;
    function readFile(path, options, cb) {
      if (typeof options === "function") (cb = options), (options = null);
      return go$readFile(path, options, cb);
      function go$readFile(path2, options2, cb2, startTime) {
        return fs$readFile(path2, options2, function (err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$readFile, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function") cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$writeFile = fs2.writeFile;
    fs2.writeFile = writeFile;
    function writeFile(path, data, options, cb) {
      if (typeof options === "function") (cb = options), (options = null);
      return go$writeFile(path, data, options, cb);
      function go$writeFile(path2, data2, options2, cb2, startTime) {
        return fs$writeFile(path2, data2, options2, function (err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$writeFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function") cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$appendFile = fs2.appendFile;
    if (fs$appendFile) fs2.appendFile = appendFile;
    function appendFile(path, data, options, cb) {
      if (typeof options === "function") (cb = options), (options = null);
      return go$appendFile(path, data, options, cb);
      function go$appendFile(path2, data2, options2, cb2, startTime) {
        return fs$appendFile(path2, data2, options2, function (err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$appendFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function") cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$copyFile = fs2.copyFile;
    if (fs$copyFile) fs2.copyFile = copyFile;
    function copyFile(src, dest, flags, cb) {
      if (typeof flags === "function") {
        cb = flags;
        flags = 0;
      }
      return go$copyFile(src, dest, flags, cb);
      function go$copyFile(src2, dest2, flags2, cb2, startTime) {
        return fs$copyFile(src2, dest2, flags2, function (err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function") cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$readdir = fs2.readdir;
    fs2.readdir = readdir;
    var noReaddirOptionVersions = /^v[0-5]\./;
    function readdir(path, options, cb) {
      if (typeof options === "function") (cb = options), (options = null);
      var go$readdir = noReaddirOptionVersions.test(process.version)
        ? function go$readdir(path2, options2, cb2, startTime) {
            return fs$readdir(path2, fs$readdirCallback(path2, options2, cb2, startTime));
          }
        : function go$readdir(path2, options2, cb2, startTime) {
            return fs$readdir(path2, options2, fs$readdirCallback(path2, options2, cb2, startTime));
          };
      return go$readdir(path, options, cb);
      function fs$readdirCallback(path2, options2, cb2, startTime) {
        return function (err, files) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$readdir, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (files && files.sort) files.sort();
            if (typeof cb2 === "function") cb2.call(this, err, files);
          }
        };
      }
    }
    if (process.version.substr(0, 4) === "v0.8") {
      var legStreams = legacy(fs2);
      ReadStream = legStreams.ReadStream;
      WriteStream = legStreams.WriteStream;
    }
    var fs$ReadStream = fs2.ReadStream;
    if (fs$ReadStream) {
      ReadStream.prototype = Object.create(fs$ReadStream.prototype);
      ReadStream.prototype.open = ReadStream$open;
    }
    var fs$WriteStream = fs2.WriteStream;
    if (fs$WriteStream) {
      WriteStream.prototype = Object.create(fs$WriteStream.prototype);
      WriteStream.prototype.open = WriteStream$open;
    }
    Object.defineProperty(fs2, "ReadStream", {
      get: function () {
        return ReadStream;
      },
      set: function (val) {
        ReadStream = val;
      },
      enumerable: true,
      configurable: true,
    });
    Object.defineProperty(fs2, "WriteStream", {
      get: function () {
        return WriteStream;
      },
      set: function (val) {
        WriteStream = val;
      },
      enumerable: true,
      configurable: true,
    });
    var FileReadStream = ReadStream;
    Object.defineProperty(fs2, "FileReadStream", {
      get: function () {
        return FileReadStream;
      },
      set: function (val) {
        FileReadStream = val;
      },
      enumerable: true,
      configurable: true,
    });
    var FileWriteStream = WriteStream;
    Object.defineProperty(fs2, "FileWriteStream", {
      get: function () {
        return FileWriteStream;
      },
      set: function (val) {
        FileWriteStream = val;
      },
      enumerable: true,
      configurable: true,
    });
    function ReadStream(path, options) {
      if (this instanceof ReadStream) return fs$ReadStream.apply(this, arguments), this;
      else return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
    }
    function ReadStream$open() {
      var that = this;
      open(that.path, that.flags, that.mode, function (err, fd) {
        if (err) {
          if (that.autoClose) that.destroy();
          that.emit("error", err);
        } else {
          that.fd = fd;
          that.emit("open", fd);
          that.read();
        }
      });
    }
    function WriteStream(path, options) {
      if (this instanceof WriteStream) return fs$WriteStream.apply(this, arguments), this;
      else return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
    }
    function WriteStream$open() {
      var that = this;
      open(that.path, that.flags, that.mode, function (err, fd) {
        if (err) {
          that.destroy();
          that.emit("error", err);
        } else {
          that.fd = fd;
          that.emit("open", fd);
        }
      });
    }
    function createReadStream(path, options) {
      return new fs2.ReadStream(path, options);
    }
    function createWriteStream(path, options) {
      return new fs2.WriteStream(path, options);
    }
    var fs$open = fs2.open;
    fs2.open = open;
    function open(path, flags, mode, cb) {
      if (typeof mode === "function") (cb = mode), (mode = null);
      return go$open(path, flags, mode, cb);
      function go$open(path2, flags2, mode2, cb2, startTime) {
        return fs$open(path2, flags2, mode2, function (err, fd) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$open, [path2, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function") cb2.apply(this, arguments);
          }
        });
      }
    }
    return fs2;
  }
  function enqueue(elem) {
    debug("ENQUEUE", elem[0].name, elem[1]);
    fs[gracefulQueue].push(elem);
    retry();
  }
  function resetQueue() {
    var now = Date.now();
    for (var i = 0; i < fs[gracefulQueue].length; ++i) {
      if (fs[gracefulQueue][i].length > 2) {
        fs[gracefulQueue][i][3] = now;
        fs[gracefulQueue][i][4] = now;
      }
    }
    retry();
  }
  function retry() {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (fs[gracefulQueue].length === 0) return;
    var elem = fs[gracefulQueue].shift();
    var fn = elem[0];
    var args = elem[1];
    var err = elem[2];
    var startTime = elem[3];
    var lastTime = elem[4];
    if (startTime === undefined) {
      debug("RETRY", fn.name, args);
      fn.apply(null, args);
    } else if (Date.now() - startTime >= 60000) {
      debug("TIMEOUT", fn.name, args);
      var cb = args.pop();
      if (typeof cb === "function") cb.call(null, err);
    } else {
      var sinceAttempt = Date.now() - lastTime;
      var sinceStart = Math.max(lastTime - startTime, 1);
      var desiredDelay = Math.min(sinceStart * 1.2, 100);
      if (sinceAttempt >= desiredDelay) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args.concat([startTime]));
      } else {
        fs[gracefulQueue].push(elem);
      }
    }
    if (retryTimer === undefined) {
      retryTimer = setTimeout(retry, 0);
    }
  }
  var fs = __require("fs");
  var polyfills = require_polyfills();
  var legacy = require_legacy_streams();
  var clone = require_clone();
  var util = __require("util");
  var gracefulQueue;
  var previousSymbol;
  if (typeof Symbol === "function" && typeof Symbol.for === "function") {
    gracefulQueue = Symbol.for("graceful-fs.queue");
    previousSymbol = Symbol.for("graceful-fs.previous");
  } else {
    gracefulQueue = "___graceful-fs.queue";
    previousSymbol = "___graceful-fs.previous";
  }
  var debug = noop;
  if (util.debuglog) debug = util.debuglog("gfs4");
  else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
    debug = function () {
      var m = util.format.apply(util, arguments);
      m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
      console.error(m);
    };
  if (!fs[gracefulQueue]) {
    queue = global[gracefulQueue] || [];
    publishQueue(fs, queue);
    fs.close = (function (fs$close) {
      function close(fd, cb) {
        return fs$close.call(fs, fd, function (err) {
          if (!err) {
            resetQueue();
          }
          if (typeof cb === "function") cb.apply(this, arguments);
        });
      }
      Object.defineProperty(close, previousSymbol, {
        value: fs$close,
      });
      return close;
    })(fs.close);
    fs.closeSync = (function (fs$closeSync) {
      function closeSync(fd) {
        fs$closeSync.apply(fs, arguments);
        resetQueue();
      }
      Object.defineProperty(closeSync, previousSymbol, {
        value: fs$closeSync,
      });
      return closeSync;
    })(fs.closeSync);
    if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
      process.on("exit", function () {
        debug(fs[gracefulQueue]);
        __require("assert").equal(fs[gracefulQueue].length, 0);
      });
    }
  }
  var queue;
  if (!global[gracefulQueue]) {
    publishQueue(global, fs[gracefulQueue]);
  }
  module.exports = patch(clone(fs));
  if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
    module.exports = patch(fs);
    fs.__patched = true;
  }
  var retryTimer;
});

// node_modules/enhanced-resolve/lib/NodeJsInputFileSystem.js
var require_NodeJsInputFileSystem = __commonJS((exports, module) => {
  var fs = require_graceful_fs();

  class NodeJsInputFileSystem {
    readdir(path, callback) {
      fs.readdir(path, (err, files) => {
        callback(
          err,
          files &&
            files.map((file) => {
              return file.normalize ? file.normalize("NFC") : file;
            })
        );
      });
    }
    readdirSync(path) {
      const files = fs.readdirSync(path);
      return (
        files &&
        files.map((file) => {
          return file.normalize ? file.normalize("NFC") : file;
        })
      );
    }
  }
  var fsMethods = ["stat", "statSync", "readFile", "readFileSync", "readlink", "readlinkSync"];
  for (const key of fsMethods) {
    Object.defineProperty(NodeJsInputFileSystem.prototype, key, {
      configurable: true,
      writable: true,
      value: fs[key].bind(fs),
    });
  }
  module.exports = NodeJsInputFileSystem;
});

// node_modules/enhanced-resolve/lib/CachedInputFileSystem.js
var require_CachedInputFileSystem = __commonJS((exports, module) => {
  class Storage {
    constructor(duration) {
      this.duration = duration;
      this.running = new Map();
      this.data = new Map();
      this.levels = [];
      if (duration > 0) {
        this.levels.push(
          new Set(),
          new Set(),
          new Set(),
          new Set(),
          new Set(),
          new Set(),
          new Set(),
          new Set(),
          new Set()
        );
        for (let i = 8000; i < duration; i += 500) this.levels.push(new Set());
      }
      this.count = 0;
      this.interval = null;
      this.needTickCheck = false;
      this.nextTick = null;
      this.passive = true;
      this.tick = this.tick.bind(this);
    }
    ensureTick() {
      if (!this.interval && this.duration > 0 && !this.nextTick)
        this.interval = setInterval(this.tick, Math.floor(this.duration / this.levels.length));
    }
    finished(name, err, result) {
      const callbacks = this.running.get(name);
      this.running.delete(name);
      if (this.duration > 0) {
        this.data.set(name, [err, result]);
        const levelData = this.levels[0];
        this.count -= levelData.size;
        levelData.add(name);
        this.count += levelData.size;
        this.ensureTick();
      }
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](err, result);
      }
    }
    finishedSync(name, err, result) {
      if (this.duration > 0) {
        this.data.set(name, [err, result]);
        const levelData = this.levels[0];
        this.count -= levelData.size;
        levelData.add(name);
        this.count += levelData.size;
        this.ensureTick();
      }
    }
    provide(name, provider, callback) {
      if (typeof name !== "string") {
        callback(new TypeError("path must be a string"));
        return;
      }
      let running = this.running.get(name);
      if (running) {
        running.push(callback);
        return;
      }
      if (this.duration > 0) {
        this.checkTicks();
        const data = this.data.get(name);
        if (data) {
          return process.nextTick(() => {
            callback.apply(null, data);
          });
        }
      }
      this.running.set(name, (running = [callback]));
      provider(name, (err, result) => {
        this.finished(name, err, result);
      });
    }
    provideSync(name, provider) {
      if (typeof name !== "string") {
        throw new TypeError("path must be a string");
      }
      if (this.duration > 0) {
        this.checkTicks();
        const data = this.data.get(name);
        if (data) {
          if (data[0]) throw data[0];
          return data[1];
        }
      }
      let result;
      try {
        result = provider(name);
      } catch (e) {
        this.finishedSync(name, e);
        throw e;
      }
      this.finishedSync(name, null, result);
      return result;
    }
    tick() {
      const decay = this.levels.pop();
      for (let item of decay) {
        this.data.delete(item);
      }
      this.count -= decay.size;
      decay.clear();
      this.levels.unshift(decay);
      if (this.count === 0) {
        clearInterval(this.interval);
        this.interval = null;
        this.nextTick = null;
        return true;
      } else if (this.nextTick) {
        this.nextTick += Math.floor(this.duration / this.levels.length);
        const time = new Date().getTime();
        if (this.nextTick > time) {
          this.nextTick = null;
          this.interval = setInterval(this.tick, Math.floor(this.duration / this.levels.length));
          return true;
        }
      } else if (this.passive) {
        clearInterval(this.interval);
        this.interval = null;
        this.nextTick = new Date().getTime() + Math.floor(this.duration / this.levels.length);
      } else {
        this.passive = true;
      }
    }
    checkTicks() {
      this.passive = false;
      if (this.nextTick) {
        while (!this.tick());
      }
    }
    purge(what) {
      if (!what) {
        this.count = 0;
        clearInterval(this.interval);
        this.nextTick = null;
        this.data.clear();
        this.levels.forEach((level) => {
          level.clear();
        });
      } else if (typeof what === "string") {
        for (let key of this.data.keys()) {
          if (key.startsWith(what)) this.data.delete(key);
        }
      } else {
        for (let i = what.length - 1; i >= 0; i--) {
          this.purge(what[i]);
        }
      }
    }
  }
  module.exports = class CachedInputFileSystem {
    constructor(fileSystem, duration) {
      this.fileSystem = fileSystem;
      this._statStorage = new Storage(duration);
      this._readdirStorage = new Storage(duration);
      this._readFileStorage = new Storage(duration);
      this._readJsonStorage = new Storage(duration);
      this._readlinkStorage = new Storage(duration);
      this._stat = this.fileSystem.stat ? this.fileSystem.stat.bind(this.fileSystem) : null;
      if (!this._stat) this.stat = null;
      this._statSync = this.fileSystem.statSync ? this.fileSystem.statSync.bind(this.fileSystem) : null;
      if (!this._statSync) this.statSync = null;
      this._readdir = this.fileSystem.readdir ? this.fileSystem.readdir.bind(this.fileSystem) : null;
      if (!this._readdir) this.readdir = null;
      this._readdirSync = this.fileSystem.readdirSync ? this.fileSystem.readdirSync.bind(this.fileSystem) : null;
      if (!this._readdirSync) this.readdirSync = null;
      this._readFile = this.fileSystem.readFile ? this.fileSystem.readFile.bind(this.fileSystem) : null;
      if (!this._readFile) this.readFile = null;
      this._readFileSync = this.fileSystem.readFileSync ? this.fileSystem.readFileSync.bind(this.fileSystem) : null;
      if (!this._readFileSync) this.readFileSync = null;
      if (this.fileSystem.readJson) {
        this._readJson = this.fileSystem.readJson.bind(this.fileSystem);
      } else if (this.readFile) {
        this._readJson = (path, callback) => {
          this.readFile(path, (err, buffer) => {
            if (err) return callback(err);
            let data;
            try {
              data = JSON.parse(buffer.toString("utf-8"));
            } catch (e) {
              return callback(e);
            }
            callback(null, data);
          });
        };
      } else {
        this.readJson = null;
      }
      if (this.fileSystem.readJsonSync) {
        this._readJsonSync = this.fileSystem.readJsonSync.bind(this.fileSystem);
      } else if (this.readFileSync) {
        this._readJsonSync = (path) => {
          const buffer = this.readFileSync(path);
          const data = JSON.parse(buffer.toString("utf-8"));
          return data;
        };
      } else {
        this.readJsonSync = null;
      }
      this._readlink = this.fileSystem.readlink ? this.fileSystem.readlink.bind(this.fileSystem) : null;
      if (!this._readlink) this.readlink = null;
      this._readlinkSync = this.fileSystem.readlinkSync ? this.fileSystem.readlinkSync.bind(this.fileSystem) : null;
      if (!this._readlinkSync) this.readlinkSync = null;
    }
    stat(path, callback) {
      this._statStorage.provide(path, this._stat, callback);
    }
    readdir(path, callback) {
      this._readdirStorage.provide(path, this._readdir, callback);
    }
    readFile(path, callback) {
      this._readFileStorage.provide(path, this._readFile, callback);
    }
    readJson(path, callback) {
      this._readJsonStorage.provide(path, this._readJson, callback);
    }
    readlink(path, callback) {
      this._readlinkStorage.provide(path, this._readlink, callback);
    }
    statSync(path) {
      return this._statStorage.provideSync(path, this._statSync);
    }
    readdirSync(path) {
      return this._readdirStorage.provideSync(path, this._readdirSync);
    }
    readFileSync(path) {
      return this._readFileStorage.provideSync(path, this._readFileSync);
    }
    readJsonSync(path) {
      return this._readJsonStorage.provideSync(path, this._readJsonSync);
    }
    readlinkSync(path) {
      return this._readlinkStorage.provideSync(path, this._readlinkSync);
    }
    purge(what) {
      this._statStorage.purge(what);
      this._readdirStorage.purge(what);
      this._readFileStorage.purge(what);
      this._readlinkStorage.purge(what);
      this._readJsonStorage.purge(what);
    }
  };
});

// node_modules/enhanced-resolve/lib/node.js
var require_node = __commonJS((exports, module) => {
  var ResolverFactory = require_ResolverFactory();
  var NodeJsInputFileSystem = require_NodeJsInputFileSystem();
  var CachedInputFileSystem = require_CachedInputFileSystem();
  var nodeFileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000);
  var nodeContext = {
    environments: ["node+es3+es5+process+native"],
  };
  var asyncResolver = ResolverFactory.createResolver({
    extensions: [".js", ".json", ".node"],
    fileSystem: nodeFileSystem,
  });
  module.exports = function resolve(context, path, request, resolveContext, callback) {
    if (typeof context === "string") {
      callback = resolveContext;
      resolveContext = request;
      request = path;
      path = context;
      context = nodeContext;
    }
    if (typeof callback !== "function") {
      callback = resolveContext;
    }
    asyncResolver.resolve(context, path, request, resolveContext, callback);
  };
  var syncResolver = ResolverFactory.createResolver({
    extensions: [".js", ".json", ".node"],
    useSyncFileSystemCalls: true,
    fileSystem: nodeFileSystem,
  });
  module.exports.sync = function resolveSync(context, path, request) {
    if (typeof context === "string") {
      request = path;
      path = context;
      context = nodeContext;
    }
    return syncResolver.resolveSync(context, path, request);
  };
  var asyncContextResolver = ResolverFactory.createResolver({
    extensions: [".js", ".json", ".node"],
    resolveToContext: true,
    fileSystem: nodeFileSystem,
  });
  module.exports.context = function resolveContext(context, path, request, resolveContext, callback) {
    if (typeof context === "string") {
      callback = resolveContext;
      resolveContext = request;
      request = path;
      path = context;
      context = nodeContext;
    }
    if (typeof callback !== "function") {
      callback = resolveContext;
    }
    asyncContextResolver.resolve(context, path, request, resolveContext, callback);
  };
  var syncContextResolver = ResolverFactory.createResolver({
    extensions: [".js", ".json", ".node"],
    resolveToContext: true,
    useSyncFileSystemCalls: true,
    fileSystem: nodeFileSystem,
  });
  module.exports.context.sync = function resolveContextSync(context, path, request) {
    if (typeof context === "string") {
      request = path;
      path = context;
      context = nodeContext;
    }
    return syncContextResolver.resolveSync(context, path, request);
  };
  var asyncLoaderResolver = ResolverFactory.createResolver({
    extensions: [".js", ".json", ".node"],
    moduleExtensions: ["-loader"],
    mainFields: ["loader", "main"],
    fileSystem: nodeFileSystem,
  });
  module.exports.loader = function resolveLoader(context, path, request, resolveContext, callback) {
    if (typeof context === "string") {
      callback = resolveContext;
      resolveContext = request;
      request = path;
      path = context;
      context = nodeContext;
    }
    if (typeof callback !== "function") {
      callback = resolveContext;
    }
    asyncLoaderResolver.resolve(context, path, request, resolveContext, callback);
  };
  var syncLoaderResolver = ResolverFactory.createResolver({
    extensions: [".js", ".json", ".node"],
    moduleExtensions: ["-loader"],
    mainFields: ["loader", "main"],
    useSyncFileSystemCalls: true,
    fileSystem: nodeFileSystem,
  });
  module.exports.loader.sync = function resolveLoaderSync(context, path, request) {
    if (typeof context === "string") {
      request = path;
      path = context;
      context = nodeContext;
    }
    return syncLoaderResolver.resolveSync(context, path, request);
  };
  module.exports.create = function create(options) {
    options = Object.assign(
      {
        fileSystem: nodeFileSystem,
      },
      options
    );
    const resolver = ResolverFactory.createResolver(options);
    return function (context, path, request, resolveContext, callback) {
      if (typeof context === "string") {
        callback = resolveContext;
        resolveContext = request;
        request = path;
        path = context;
        context = nodeContext;
      }
      if (typeof callback !== "function") {
        callback = resolveContext;
      }
      resolver.resolve(context, path, request, resolveContext, callback);
    };
  };
  module.exports.create.sync = function createSync(options) {
    options = Object.assign(
      {
        useSyncFileSystemCalls: true,
        fileSystem: nodeFileSystem,
      },
      options
    );
    const resolver = ResolverFactory.createResolver(options);
    return function (context, path, request) {
      if (typeof context === "string") {
        request = path;
        path = context;
        context = nodeContext;
      }
      return resolver.resolveSync(context, path, request);
    };
  };
  module.exports.ResolverFactory = ResolverFactory;
  module.exports.NodeJsInputFileSystem = NodeJsInputFileSystem;
  module.exports.CachedInputFileSystem = CachedInputFileSystem;
});

// node_modules/tsconfig-paths-webpack-plugin/node_modules/enhanced-resolve/lib/createInnerContext.js
var require_createInnerContext2 = __commonJS((exports, module) => {
  module.exports = function createInnerContext(options, message) {
    let messageReported = false;
    let innerLog = undefined;
    if (options.log) {
      if (message) {
        innerLog = (msg) => {
          if (!messageReported) {
            options.log(message);
            messageReported = true;
          }
          options.log("  " + msg);
        };
      } else {
        innerLog = options.log;
      }
    }
    return {
      log: innerLog,
      yield: options.yield,
      fileDependencies: options.fileDependencies,
      contextDependencies: options.contextDependencies,
      missingDependencies: options.missingDependencies,
      stack: options.stack,
    };
  };
});

// node_modules/enhanced-resolve/lib/createInnerCallback.js
var require_createInnerCallback = __commonJS((exports, module) => {
  var util = __require("util");
  module.exports = util.deprecate(function createInnerCallback(callback, options, message, messageOptional) {
    const log = options.log;
    if (!log) {
      if (options.stack !== callback.stack) {
        const callbackWrapper = function callbackWrapper() {
          return callback.apply(this, arguments);
        };
        callbackWrapper.stack = options.stack;
        callbackWrapper.missing = options.missing;
        return callbackWrapper;
      }
      return callback;
    }
    function loggingCallbackWrapper() {
      return callback.apply(this, arguments);
    }
    if (message) {
      if (!messageOptional) {
        log(message);
      }
      loggingCallbackWrapper.log = function writeLog(msg) {
        if (messageOptional) {
          log(message);
          messageOptional = false;
        }
        log("  " + msg);
      };
    } else {
      loggingCallbackWrapper.log = function writeLog(msg) {
        log(msg);
      };
    }
    loggingCallbackWrapper.stack = options.stack;
    loggingCallbackWrapper.missing = options.missing;
    return loggingCallbackWrapper;
  }, "Pass resolveContext instead and use createInnerContext");
});

// node_modules/color-name/index.js
var require_color_name = __commonJS((exports, module) => {
  module.exports = {
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    grey: [128, 128, 128],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    rebeccapurple: [102, 51, 153],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50],
  };
});

// node_modules/color-convert/conversions.js
var require_conversions = __commonJS((exports, module) => {
  function comparativeDistance(x, y) {
    return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
  }
  var cssKeywords = require_color_name();
  var reverseKeywords = {};
  for (const key of Object.keys(cssKeywords)) {
    reverseKeywords[cssKeywords[key]] = key;
  }
  var convert = {
    rgb: { channels: 3, labels: "rgb" },
    hsl: { channels: 3, labels: "hsl" },
    hsv: { channels: 3, labels: "hsv" },
    hwb: { channels: 3, labels: "hwb" },
    cmyk: { channels: 4, labels: "cmyk" },
    xyz: { channels: 3, labels: "xyz" },
    lab: { channels: 3, labels: "lab" },
    lch: { channels: 3, labels: "lch" },
    hex: { channels: 1, labels: ["hex"] },
    keyword: { channels: 1, labels: ["keyword"] },
    ansi16: { channels: 1, labels: ["ansi16"] },
    ansi256: { channels: 1, labels: ["ansi256"] },
    hcg: { channels: 3, labels: ["h", "c", "g"] },
    apple: { channels: 3, labels: ["r16", "g16", "b16"] },
    gray: { channels: 1, labels: ["gray"] },
  };
  module.exports = convert;
  for (const model of Object.keys(convert)) {
    if (!("channels" in convert[model])) {
      throw new Error("missing channels property: " + model);
    }
    if (!("labels" in convert[model])) {
      throw new Error("missing channel labels property: " + model);
    }
    if (convert[model].labels.length !== convert[model].channels) {
      throw new Error("channel and label counts mismatch: " + model);
    }
    const { channels, labels } = convert[model];
    delete convert[model].channels;
    delete convert[model].labels;
    Object.defineProperty(convert[model], "channels", { value: channels });
    Object.defineProperty(convert[model], "labels", { value: labels });
  }
  convert.rgb.hsl = function (rgb) {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const delta = max - min;
    let h;
    let s;
    if (max === min) {
      h = 0;
    } else if (r === max) {
      h = (g - b) / delta;
    } else if (g === max) {
      h = 2 + (b - r) / delta;
    } else if (b === max) {
      h = 4 + (r - g) / delta;
    }
    h = Math.min(h * 60, 360);
    if (h < 0) {
      h += 360;
    }
    const l = (min + max) / 2;
    if (max === min) {
      s = 0;
    } else if (l <= 0.5) {
      s = delta / (max + min);
    } else {
      s = delta / (2 - max - min);
    }
    return [h, s * 100, l * 100];
  };
  convert.rgb.hsv = function (rgb) {
    let rdif;
    let gdif;
    let bdif;
    let h;
    let s;
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    const v = Math.max(r, g, b);
    const diff = v - Math.min(r, g, b);
    const diffc = function (c) {
      return (v - c) / 6 / diff + 1 / 2;
    };
    if (diff === 0) {
      h = 0;
      s = 0;
    } else {
      s = diff / v;
      rdif = diffc(r);
      gdif = diffc(g);
      bdif = diffc(b);
      if (r === v) {
        h = bdif - gdif;
      } else if (g === v) {
        h = 1 / 3 + rdif - bdif;
      } else if (b === v) {
        h = 2 / 3 + gdif - rdif;
      }
      if (h < 0) {
        h += 1;
      } else if (h > 1) {
        h -= 1;
      }
    }
    return [h * 360, s * 100, v * 100];
  };
  convert.rgb.hwb = function (rgb) {
    const r = rgb[0];
    const g = rgb[1];
    let b = rgb[2];
    const h = convert.rgb.hsl(rgb)[0];
    const w = (1 / 255) * Math.min(r, Math.min(g, b));
    b = 1 - (1 / 255) * Math.max(r, Math.max(g, b));
    return [h, w * 100, b * 100];
  };
  convert.rgb.cmyk = function (rgb) {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    const k = Math.min(1 - r, 1 - g, 1 - b);
    const c = (1 - r - k) / (1 - k) || 0;
    const m = (1 - g - k) / (1 - k) || 0;
    const y = (1 - b - k) / (1 - k) || 0;
    return [c * 100, m * 100, y * 100, k * 100];
  };
  convert.rgb.keyword = function (rgb) {
    const reversed = reverseKeywords[rgb];
    if (reversed) {
      return reversed;
    }
    let currentClosestDistance = Infinity;
    let currentClosestKeyword;
    for (const keyword of Object.keys(cssKeywords)) {
      const value = cssKeywords[keyword];
      const distance = comparativeDistance(rgb, value);
      if (distance < currentClosestDistance) {
        currentClosestDistance = distance;
        currentClosestKeyword = keyword;
      }
    }
    return currentClosestKeyword;
  };
  convert.keyword.rgb = function (keyword) {
    return cssKeywords[keyword];
  };
  convert.rgb.xyz = function (rgb) {
    let r = rgb[0] / 255;
    let g = rgb[1] / 255;
    let b = rgb[2] / 255;
    r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
    g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
    b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;
    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    return [x * 100, y * 100, z * 100];
  };
  convert.rgb.lab = function (rgb) {
    const xyz = convert.rgb.xyz(rgb);
    let x = xyz[0];
    let y = xyz[1];
    let z = xyz[2];
    x /= 95.047;
    y /= 100;
    z /= 108.883;
    x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
    const l = 116 * y - 16;
    const a = 500 * (x - y);
    const b = 200 * (y - z);
    return [l, a, b];
  };
  convert.hsl.rgb = function (hsl) {
    const h = hsl[0] / 360;
    const s = hsl[1] / 100;
    const l = hsl[2] / 100;
    let t2;
    let t3;
    let val;
    if (s === 0) {
      val = l * 255;
      return [val, val, val];
    }
    if (l < 0.5) {
      t2 = l * (1 + s);
    } else {
      t2 = l + s - l * s;
    }
    const t1 = 2 * l - t2;
    const rgb = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      t3 = h + (1 / 3) * -(i - 1);
      if (t3 < 0) {
        t3++;
      }
      if (t3 > 1) {
        t3--;
      }
      if (6 * t3 < 1) {
        val = t1 + (t2 - t1) * 6 * t3;
      } else if (2 * t3 < 1) {
        val = t2;
      } else if (3 * t3 < 2) {
        val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
      } else {
        val = t1;
      }
      rgb[i] = val * 255;
    }
    return rgb;
  };
  convert.hsl.hsv = function (hsl) {
    const h = hsl[0];
    let s = hsl[1] / 100;
    let l = hsl[2] / 100;
    let smin = s;
    const lmin = Math.max(l, 0.01);
    l *= 2;
    s *= l <= 1 ? l : 2 - l;
    smin *= lmin <= 1 ? lmin : 2 - lmin;
    const v = (l + s) / 2;
    const sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);
    return [h, sv * 100, v * 100];
  };
  convert.hsv.rgb = function (hsv) {
    const h = hsv[0] / 60;
    const s = hsv[1] / 100;
    let v = hsv[2] / 100;
    const hi = Math.floor(h) % 6;
    const f = h - Math.floor(h);
    const p = 255 * v * (1 - s);
    const q = 255 * v * (1 - s * f);
    const t = 255 * v * (1 - s * (1 - f));
    v *= 255;
    switch (hi) {
      case 0:
        return [v, t, p];
      case 1:
        return [q, v, p];
      case 2:
        return [p, v, t];
      case 3:
        return [p, q, v];
      case 4:
        return [t, p, v];
      case 5:
        return [v, p, q];
    }
  };
  convert.hsv.hsl = function (hsv) {
    const h = hsv[0];
    const s = hsv[1] / 100;
    const v = hsv[2] / 100;
    const vmin = Math.max(v, 0.01);
    let sl;
    let l;
    l = (2 - s) * v;
    const lmin = (2 - s) * vmin;
    sl = s * vmin;
    sl /= lmin <= 1 ? lmin : 2 - lmin;
    sl = sl || 0;
    l /= 2;
    return [h, sl * 100, l * 100];
  };
  convert.hwb.rgb = function (hwb) {
    const h = hwb[0] / 360;
    let wh = hwb[1] / 100;
    let bl = hwb[2] / 100;
    const ratio = wh + bl;
    let f;
    if (ratio > 1) {
      wh /= ratio;
      bl /= ratio;
    }
    const i = Math.floor(6 * h);
    const v = 1 - bl;
    f = 6 * h - i;
    if ((i & 1) !== 0) {
      f = 1 - f;
    }
    const n = wh + f * (v - wh);
    let r;
    let g;
    let b;
    switch (i) {
      default:
      case 6:
      case 0:
        r = v;
        g = n;
        b = wh;
        break;
      case 1:
        r = n;
        g = v;
        b = wh;
        break;
      case 2:
        r = wh;
        g = v;
        b = n;
        break;
      case 3:
        r = wh;
        g = n;
        b = v;
        break;
      case 4:
        r = n;
        g = wh;
        b = v;
        break;
      case 5:
        r = v;
        g = wh;
        b = n;
        break;
    }
    return [r * 255, g * 255, b * 255];
  };
  convert.cmyk.rgb = function (cmyk) {
    const c = cmyk[0] / 100;
    const m = cmyk[1] / 100;
    const y = cmyk[2] / 100;
    const k = cmyk[3] / 100;
    const r = 1 - Math.min(1, c * (1 - k) + k);
    const g = 1 - Math.min(1, m * (1 - k) + k);
    const b = 1 - Math.min(1, y * (1 - k) + k);
    return [r * 255, g * 255, b * 255];
  };
  convert.xyz.rgb = function (xyz) {
    const x = xyz[0] / 100;
    const y = xyz[1] / 100;
    const z = xyz[2] / 100;
    let r;
    let g;
    let b;
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.204 + z * 1.057;
    r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : r * 12.92;
    g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : g * 12.92;
    b = b > 0.0031308 ? 1.055 * b ** (1 / 2.4) - 0.055 : b * 12.92;
    r = Math.min(Math.max(0, r), 1);
    g = Math.min(Math.max(0, g), 1);
    b = Math.min(Math.max(0, b), 1);
    return [r * 255, g * 255, b * 255];
  };
  convert.xyz.lab = function (xyz) {
    let x = xyz[0];
    let y = xyz[1];
    let z = xyz[2];
    x /= 95.047;
    y /= 100;
    z /= 108.883;
    x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
    const l = 116 * y - 16;
    const a = 500 * (x - y);
    const b = 200 * (y - z);
    return [l, a, b];
  };
  convert.lab.xyz = function (lab) {
    const l = lab[0];
    const a = lab[1];
    const b = lab[2];
    let x;
    let y;
    let z;
    y = (l + 16) / 116;
    x = a / 500 + y;
    z = y - b / 200;
    const y2 = y ** 3;
    const x2 = x ** 3;
    const z2 = z ** 3;
    y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
    x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
    z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;
    x *= 95.047;
    y *= 100;
    z *= 108.883;
    return [x, y, z];
  };
  convert.lab.lch = function (lab) {
    const l = lab[0];
    const a = lab[1];
    const b = lab[2];
    let h;
    const hr = Math.atan2(b, a);
    h = (hr * 360) / 2 / Math.PI;
    if (h < 0) {
      h += 360;
    }
    const c = Math.sqrt(a * a + b * b);
    return [l, c, h];
  };
  convert.lch.lab = function (lch) {
    const l = lch[0];
    const c = lch[1];
    const h = lch[2];
    const hr = (h / 360) * 2 * Math.PI;
    const a = c * Math.cos(hr);
    const b = c * Math.sin(hr);
    return [l, a, b];
  };
  convert.rgb.ansi16 = function (args, saturation = null) {
    const [r, g, b] = args;
    let value = saturation === null ? convert.rgb.hsv(args)[2] : saturation;
    value = Math.round(value / 50);
    if (value === 0) {
      return 30;
    }
    let ansi = 30 + ((Math.round(b / 255) << 2) | (Math.round(g / 255) << 1) | Math.round(r / 255));
    if (value === 2) {
      ansi += 60;
    }
    return ansi;
  };
  convert.hsv.ansi16 = function (args) {
    return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
  };
  convert.rgb.ansi256 = function (args) {
    const r = args[0];
    const g = args[1];
    const b = args[2];
    if (r === g && g === b) {
      if (r < 8) {
        return 16;
      }
      if (r > 248) {
        return 231;
      }
      return Math.round(((r - 8) / 247) * 24) + 232;
    }
    const ansi = 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
    return ansi;
  };
  convert.ansi16.rgb = function (args) {
    let color = args % 10;
    if (color === 0 || color === 7) {
      if (args > 50) {
        color += 3.5;
      }
      color = (color / 10.5) * 255;
      return [color, color, color];
    }
    const mult = (~~(args > 50) + 1) * 0.5;
    const r = (color & 1) * mult * 255;
    const g = ((color >> 1) & 1) * mult * 255;
    const b = ((color >> 2) & 1) * mult * 255;
    return [r, g, b];
  };
  convert.ansi256.rgb = function (args) {
    if (args >= 232) {
      const c = (args - 232) * 10 + 8;
      return [c, c, c];
    }
    args -= 16;
    let rem;
    const r = (Math.floor(args / 36) / 5) * 255;
    const g = (Math.floor((rem = args % 36) / 6) / 5) * 255;
    const b = ((rem % 6) / 5) * 255;
    return [r, g, b];
  };
  convert.rgb.hex = function (args) {
    const integer =
      ((Math.round(args[0]) & 255) << 16) + ((Math.round(args[1]) & 255) << 8) + (Math.round(args[2]) & 255);
    const string = integer.toString(16).toUpperCase();
    return "000000".substring(string.length) + string;
  };
  convert.hex.rgb = function (args) {
    const match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
    if (!match) {
      return [0, 0, 0];
    }
    let colorString = match[0];
    if (match[0].length === 3) {
      colorString = colorString
        .split("")
        .map((char) => {
          return char + char;
        })
        .join("");
    }
    const integer = parseInt(colorString, 16);
    const r = (integer >> 16) & 255;
    const g = (integer >> 8) & 255;
    const b = integer & 255;
    return [r, g, b];
  };
  convert.rgb.hcg = function (rgb) {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    const max = Math.max(Math.max(r, g), b);
    const min = Math.min(Math.min(r, g), b);
    const chroma = max - min;
    let grayscale;
    let hue;
    if (chroma < 1) {
      grayscale = min / (1 - chroma);
    } else {
      grayscale = 0;
    }
    if (chroma <= 0) {
      hue = 0;
    } else if (max === r) {
      hue = ((g - b) / chroma) % 6;
    } else if (max === g) {
      hue = 2 + (b - r) / chroma;
    } else {
      hue = 4 + (r - g) / chroma;
    }
    hue /= 6;
    hue %= 1;
    return [hue * 360, chroma * 100, grayscale * 100];
  };
  convert.hsl.hcg = function (hsl) {
    const s = hsl[1] / 100;
    const l = hsl[2] / 100;
    const c = l < 0.5 ? 2 * s * l : 2 * s * (1 - l);
    let f = 0;
    if (c < 1) {
      f = (l - 0.5 * c) / (1 - c);
    }
    return [hsl[0], c * 100, f * 100];
  };
  convert.hsv.hcg = function (hsv) {
    const s = hsv[1] / 100;
    const v = hsv[2] / 100;
    const c = s * v;
    let f = 0;
    if (c < 1) {
      f = (v - c) / (1 - c);
    }
    return [hsv[0], c * 100, f * 100];
  };
  convert.hcg.rgb = function (hcg) {
    const h = hcg[0] / 360;
    const c = hcg[1] / 100;
    const g = hcg[2] / 100;
    if (c === 0) {
      return [g * 255, g * 255, g * 255];
    }
    const pure = [0, 0, 0];
    const hi = (h % 1) * 6;
    const v = hi % 1;
    const w = 1 - v;
    let mg = 0;
    switch (Math.floor(hi)) {
      case 0:
        pure[0] = 1;
        pure[1] = v;
        pure[2] = 0;
        break;
      case 1:
        pure[0] = w;
        pure[1] = 1;
        pure[2] = 0;
        break;
      case 2:
        pure[0] = 0;
        pure[1] = 1;
        pure[2] = v;
        break;
      case 3:
        pure[0] = 0;
        pure[1] = w;
        pure[2] = 1;
        break;
      case 4:
        pure[0] = v;
        pure[1] = 0;
        pure[2] = 1;
        break;
      default:
        pure[0] = 1;
        pure[1] = 0;
        pure[2] = w;
    }
    mg = (1 - c) * g;
    return [(c * pure[0] + mg) * 255, (c * pure[1] + mg) * 255, (c * pure[2] + mg) * 255];
  };
  convert.hcg.hsv = function (hcg) {
    const c = hcg[1] / 100;
    const g = hcg[2] / 100;
    const v = c + g * (1 - c);
    let f = 0;
    if (v > 0) {
      f = c / v;
    }
    return [hcg[0], f * 100, v * 100];
  };
  convert.hcg.hsl = function (hcg) {
    const c = hcg[1] / 100;
    const g = hcg[2] / 100;
    const l = g * (1 - c) + 0.5 * c;
    let s = 0;
    if (l > 0 && l < 0.5) {
      s = c / (2 * l);
    } else if (l >= 0.5 && l < 1) {
      s = c / (2 * (1 - l));
    }
    return [hcg[0], s * 100, l * 100];
  };
  convert.hcg.hwb = function (hcg) {
    const c = hcg[1] / 100;
    const g = hcg[2] / 100;
    const v = c + g * (1 - c);
    return [hcg[0], (v - c) * 100, (1 - v) * 100];
  };
  convert.hwb.hcg = function (hwb) {
    const w = hwb[1] / 100;
    const b = hwb[2] / 100;
    const v = 1 - b;
    const c = v - w;
    let g = 0;
    if (c < 1) {
      g = (v - c) / (1 - c);
    }
    return [hwb[0], c * 100, g * 100];
  };
  convert.apple.rgb = function (apple) {
    return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
  };
  convert.rgb.apple = function (rgb) {
    return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
  };
  convert.gray.rgb = function (args) {
    return [(args[0] / 100) * 255, (args[0] / 100) * 255, (args[0] / 100) * 255];
  };
  convert.gray.hsl = function (args) {
    return [0, 0, args[0]];
  };
  convert.gray.hsv = convert.gray.hsl;
  convert.gray.hwb = function (gray) {
    return [0, 100, gray[0]];
  };
  convert.gray.cmyk = function (gray) {
    return [0, 0, 0, gray[0]];
  };
  convert.gray.lab = function (gray) {
    return [gray[0], 0, 0];
  };
  convert.gray.hex = function (gray) {
    const val = Math.round((gray[0] / 100) * 255) & 255;
    const integer = (val << 16) + (val << 8) + val;
    const string = integer.toString(16).toUpperCase();
    return "000000".substring(string.length) + string;
  };
  convert.rgb.gray = function (rgb) {
    const val = (rgb[0] + rgb[1] + rgb[2]) / 3;
    return [(val / 255) * 100];
  };
});

// node_modules/color-convert/route.js
var require_route = __commonJS((exports, module) => {
  function buildGraph() {
    const graph = {};
    const models = Object.keys(conversions);
    for (let len = models.length, i = 0; i < len; i++) {
      graph[models[i]] = {
        distance: -1,
        parent: null,
      };
    }
    return graph;
  }
  function deriveBFS(fromModel) {
    const graph = buildGraph();
    const queue = [fromModel];
    graph[fromModel].distance = 0;
    while (queue.length) {
      const current = queue.pop();
      const adjacents = Object.keys(conversions[current]);
      for (let len = adjacents.length, i = 0; i < len; i++) {
        const adjacent = adjacents[i];
        const node = graph[adjacent];
        if (node.distance === -1) {
          node.distance = graph[current].distance + 1;
          node.parent = current;
          queue.unshift(adjacent);
        }
      }
    }
    return graph;
  }
  function link(from, to) {
    return function (args) {
      return to(from(args));
    };
  }
  function wrapConversion(toModel, graph) {
    const path = [graph[toModel].parent, toModel];
    let fn = conversions[graph[toModel].parent][toModel];
    let cur = graph[toModel].parent;
    while (graph[cur].parent) {
      path.unshift(graph[cur].parent);
      fn = link(conversions[graph[cur].parent][cur], fn);
      cur = graph[cur].parent;
    }
    fn.conversion = path;
    return fn;
  }
  var conversions = require_conversions();
  module.exports = function (fromModel) {
    const graph = deriveBFS(fromModel);
    const conversion = {};
    const models = Object.keys(graph);
    for (let len = models.length, i = 0; i < len; i++) {
      const toModel = models[i];
      const node = graph[toModel];
      if (node.parent === null) {
        continue;
      }
      conversion[toModel] = wrapConversion(toModel, graph);
    }
    return conversion;
  };
});

// node_modules/color-convert/index.js
var require_color_convert = __commonJS((exports, module) => {
  function wrapRaw(fn) {
    const wrappedFn = function (...args) {
      const arg0 = args[0];
      if (arg0 === undefined || arg0 === null) {
        return arg0;
      }
      if (arg0.length > 1) {
        args = arg0;
      }
      return fn(args);
    };
    if ("conversion" in fn) {
      wrappedFn.conversion = fn.conversion;
    }
    return wrappedFn;
  }
  function wrapRounded(fn) {
    const wrappedFn = function (...args) {
      const arg0 = args[0];
      if (arg0 === undefined || arg0 === null) {
        return arg0;
      }
      if (arg0.length > 1) {
        args = arg0;
      }
      const result = fn(args);
      if (typeof result === "object") {
        for (let len = result.length, i = 0; i < len; i++) {
          result[i] = Math.round(result[i]);
        }
      }
      return result;
    };
    if ("conversion" in fn) {
      wrappedFn.conversion = fn.conversion;
    }
    return wrappedFn;
  }
  var conversions = require_conversions();
  var route = require_route();
  var convert = {};
  var models = Object.keys(conversions);
  models.forEach((fromModel) => {
    convert[fromModel] = {};
    Object.defineProperty(convert[fromModel], "channels", { value: conversions[fromModel].channels });
    Object.defineProperty(convert[fromModel], "labels", { value: conversions[fromModel].labels });
    const routes = route(fromModel);
    const routeModels = Object.keys(routes);
    routeModels.forEach((toModel) => {
      const fn = routes[toModel];
      convert[fromModel][toModel] = wrapRounded(fn);
      convert[fromModel][toModel].raw = wrapRaw(fn);
    });
  });
  module.exports = convert;
});

// node_modules/ansi-styles/index.js
var require_ansi_styles = __commonJS((exports, module) => {
  function assembleStyles() {
    const codes = new Map();
    const styles = {
      modifier: {
        reset: [0, 0],
        bold: [1, 22],
        dim: [2, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        hidden: [8, 28],
        strikethrough: [9, 29],
      },
      color: {
        black: [30, 39],
        red: [31, 39],
        green: [32, 39],
        yellow: [33, 39],
        blue: [34, 39],
        magenta: [35, 39],
        cyan: [36, 39],
        white: [37, 39],
        blackBright: [90, 39],
        redBright: [91, 39],
        greenBright: [92, 39],
        yellowBright: [93, 39],
        blueBright: [94, 39],
        magentaBright: [95, 39],
        cyanBright: [96, 39],
        whiteBright: [97, 39],
      },
      bgColor: {
        bgBlack: [40, 49],
        bgRed: [41, 49],
        bgGreen: [42, 49],
        bgYellow: [43, 49],
        bgBlue: [44, 49],
        bgMagenta: [45, 49],
        bgCyan: [46, 49],
        bgWhite: [47, 49],
        bgBlackBright: [100, 49],
        bgRedBright: [101, 49],
        bgGreenBright: [102, 49],
        bgYellowBright: [103, 49],
        bgBlueBright: [104, 49],
        bgMagentaBright: [105, 49],
        bgCyanBright: [106, 49],
        bgWhiteBright: [107, 49],
      },
    };
    styles.color.gray = styles.color.blackBright;
    styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
    styles.color.grey = styles.color.blackBright;
    styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;
    for (const [groupName, group] of Object.entries(styles)) {
      for (const [styleName, style] of Object.entries(group)) {
        styles[styleName] = {
          open: `\x1B[${style[0]}m`,
          close: `\x1B[${style[1]}m`,
        };
        group[styleName] = styles[styleName];
        codes.set(style[0], style[1]);
      }
      Object.defineProperty(styles, groupName, {
        value: group,
        enumerable: false,
      });
    }
    Object.defineProperty(styles, "codes", {
      value: codes,
      enumerable: false,
    });
    styles.color.close = "\x1B[39m";
    styles.bgColor.close = "\x1B[49m";
    setLazyProperty(styles.color, "ansi", () => makeDynamicStyles(wrapAnsi16, "ansi16", ansi2ansi, false));
    setLazyProperty(styles.color, "ansi256", () => makeDynamicStyles(wrapAnsi256, "ansi256", ansi2ansi, false));
    setLazyProperty(styles.color, "ansi16m", () => makeDynamicStyles(wrapAnsi16m, "rgb", rgb2rgb, false));
    setLazyProperty(styles.bgColor, "ansi", () => makeDynamicStyles(wrapAnsi16, "ansi16", ansi2ansi, true));
    setLazyProperty(styles.bgColor, "ansi256", () => makeDynamicStyles(wrapAnsi256, "ansi256", ansi2ansi, true));
    setLazyProperty(styles.bgColor, "ansi16m", () => makeDynamicStyles(wrapAnsi16m, "rgb", rgb2rgb, true));
    return styles;
  }
  var wrapAnsi16 =
    (fn, offset) =>
    (...args) => {
      const code = fn(...args);
      return `\x1B[${code + offset}m`;
    };
  var wrapAnsi256 =
    (fn, offset) =>
    (...args) => {
      const code = fn(...args);
      return `\x1B[${38 + offset};5;${code}m`;
    };
  var wrapAnsi16m =
    (fn, offset) =>
    (...args) => {
      const rgb = fn(...args);
      return `\x1B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    };
  var ansi2ansi = (n) => n;
  var rgb2rgb = (r, g, b) => [r, g, b];
  var setLazyProperty = (object, property, get) => {
    Object.defineProperty(object, property, {
      get: () => {
        const value = get();
        Object.defineProperty(object, property, {
          value,
          enumerable: true,
          configurable: true,
        });
        return value;
      },
      enumerable: true,
      configurable: true,
    });
  };
  var colorConvert;
  var makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
    if (colorConvert === undefined) {
      colorConvert = require_color_convert();
    }
    const offset = isBackground ? 10 : 0;
    const styles = {};
    for (const [sourceSpace, suite] of Object.entries(colorConvert)) {
      const name = sourceSpace === "ansi16" ? "ansi" : sourceSpace;
      if (sourceSpace === targetSpace) {
        styles[name] = wrap(identity, offset);
      } else if (typeof suite === "object") {
        styles[name] = wrap(suite[targetSpace], offset);
      }
    }
    return styles;
  };
  Object.defineProperty(module, "exports", {
    enumerable: true,
    get: assembleStyles,
  });
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS((exports, module) => {
  module.exports = (flag, argv = process.argv) => {
    const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf("--");
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
  };
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS((exports, module) => {
  function translateLevel(level) {
    if (level === 0) {
      return false;
    }
    return {
      level,
      hasBasic: true,
      has256: level >= 2,
      has16m: level >= 3,
    };
  }
  function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
      return 0;
    }
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === undefined) {
      return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === "dumb") {
      return min;
    }
    if (process.platform === "win32") {
      const osRelease = os.release().split(".");
      if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
        return Number(osRelease[2]) >= 14931 ? 3 : 2;
      }
      return 1;
    }
    if ("CI" in env) {
      if (
        ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) ||
        env.CI_NAME === "codeship"
      ) {
        return 1;
      }
      return min;
    }
    if ("TEAMCITY_VERSION" in env) {
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === "truecolor") {
      return 3;
    }
    if ("TERM_PROGRAM" in env) {
      const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (env.TERM_PROGRAM) {
        case "iTerm.app":
          return version >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
      return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
      return 1;
    }
    if ("COLORTERM" in env) {
      return 1;
    }
    return min;
  }
  function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
  }
  var os = __require("os");
  var tty = __require("tty");
  var hasFlag = require_has_flag();
  var { env } = process;
  var forceColor;
  if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
    forceColor = 0;
  } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
    forceColor = 1;
  }
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      forceColor = 1;
    } else if (env.FORCE_COLOR === "false") {
      forceColor = 0;
    } else {
      forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
  }
  module.exports = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2))),
  };
});

// node_modules/chalk/source/util.js
var require_util = __commonJS((exports, module) => {
  var stringReplaceAll = (string, substring, replacer) => {
    let index = string.indexOf(substring);
    if (index === -1) {
      return string;
    }
    const substringLength = substring.length;
    let endIndex = 0;
    let returnValue = "";
    do {
      returnValue += string.substr(endIndex, index - endIndex) + substring + replacer;
      endIndex = index + substringLength;
      index = string.indexOf(substring, endIndex);
    } while (index !== -1);
    returnValue += string.substr(endIndex);
    return returnValue;
  };
  var stringEncaseCRLFWithFirstIndex = (string, prefix, postfix, index) => {
    let endIndex = 0;
    let returnValue = "";
    do {
      const gotCR = string[index - 1] === "\r";
      returnValue +=
        string.substr(endIndex, (gotCR ? index - 1 : index) - endIndex) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
      endIndex = index + 1;
      index = string.indexOf("\n", endIndex);
    } while (index !== -1);
    returnValue += string.substr(endIndex);
    return returnValue;
  };
  module.exports = {
    stringReplaceAll,
    stringEncaseCRLFWithFirstIndex,
  };
});

// node_modules/chalk/source/templates.js
var require_templates = __commonJS((exports, module) => {
  function unescape(c) {
    const u = c[0] === "u";
    const bracket = c[1] === "{";
    if ((u && !bracket && c.length === 5) || (c[0] === "x" && c.length === 3)) {
      return String.fromCharCode(parseInt(c.slice(1), 16));
    }
    if (u && bracket) {
      return String.fromCodePoint(parseInt(c.slice(2, -1), 16));
    }
    return ESCAPES.get(c) || c;
  }
  function parseArguments(name, arguments_) {
    const results = [];
    const chunks = arguments_.trim().split(/\s*,\s*/g);
    let matches;
    for (const chunk of chunks) {
      const number = Number(chunk);
      if (!Number.isNaN(number)) {
        results.push(number);
      } else if ((matches = chunk.match(STRING_REGEX))) {
        results.push(
          matches[2].replace(ESCAPE_REGEX, (m, escape, character) => (escape ? unescape(escape) : character))
        );
      } else {
        throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
      }
    }
    return results;
  }
  function parseStyle(style) {
    STYLE_REGEX.lastIndex = 0;
    const results = [];
    let matches;
    while ((matches = STYLE_REGEX.exec(style)) !== null) {
      const name = matches[1];
      if (matches[2]) {
        const args = parseArguments(name, matches[2]);
        results.push([name].concat(args));
      } else {
        results.push([name]);
      }
    }
    return results;
  }
  function buildStyle(chalk, styles) {
    const enabled = {};
    for (const layer of styles) {
      for (const style of layer.styles) {
        enabled[style[0]] = layer.inverse ? null : style.slice(1);
      }
    }
    let current = chalk;
    for (const [styleName, styles2] of Object.entries(enabled)) {
      if (!Array.isArray(styles2)) {
        continue;
      }
      if (!(styleName in current)) {
        throw new Error(`Unknown Chalk style: ${styleName}`);
      }
      current = styles2.length > 0 ? current[styleName](...styles2) : current[styleName];
    }
    return current;
  }
  var TEMPLATE_REGEX =
    /(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
  var STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
  var STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
  var ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.)|([^\\])/gi;
  var ESCAPES = new Map([
    ["n", "\n"],
    ["r", "\r"],
    ["t", "\t"],
    ["b", "\b"],
    ["f", "\f"],
    ["v", "\v"],
    ["0", "\0"],
    ["\\", "\\"],
    ["e", "\x1B"],
    ["a", "\x07"],
  ]);
  module.exports = (chalk, temporary) => {
    const styles = [];
    const chunks = [];
    let chunk = [];
    temporary.replace(TEMPLATE_REGEX, (m, escapeCharacter, inverse, style, close, character) => {
      if (escapeCharacter) {
        chunk.push(unescape(escapeCharacter));
      } else if (style) {
        const string = chunk.join("");
        chunk = [];
        chunks.push(styles.length === 0 ? string : buildStyle(chalk, styles)(string));
        styles.push({ inverse, styles: parseStyle(style) });
      } else if (close) {
        if (styles.length === 0) {
          throw new Error("Found extraneous } in Chalk template literal");
        }
        chunks.push(buildStyle(chalk, styles)(chunk.join("")));
        chunk = [];
        styles.pop();
      } else {
        chunk.push(character);
      }
    });
    chunks.push(chunk.join(""));
    if (styles.length > 0) {
      const errMessage = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? "" : "s"} (\`}\`)`;
      throw new Error(errMessage);
    }
    return chunks.join("");
  };
});

// node_modules/chalk/source/index.js
var require_source = __commonJS((exports, module) => {
  function Chalk(options) {
    return chalkFactory(options);
  }
  var ansiStyles = require_ansi_styles();
  var { stdout: stdoutColor, stderr: stderrColor } = require_supports_color();
  var { stringReplaceAll, stringEncaseCRLFWithFirstIndex } = require_util();
  var { isArray } = Array;
  var levelMapping = ["ansi", "ansi", "ansi256", "ansi16m"];
  var styles = Object.create(null);
  var applyOptions = (object, options = {}) => {
    if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
      throw new Error("The `level` option should be an integer from 0 to 3");
    }
    const colorLevel = stdoutColor ? stdoutColor.level : 0;
    object.level = options.level === undefined ? colorLevel : options.level;
  };

  class ChalkClass {
    constructor(options) {
      return chalkFactory(options);
    }
  }
  var chalkFactory = (options) => {
    const chalk2 = {};
    applyOptions(chalk2, options);
    chalk2.template = (...arguments_) => chalkTag(chalk2.template, ...arguments_);
    Object.setPrototypeOf(chalk2, Chalk.prototype);
    Object.setPrototypeOf(chalk2.template, chalk2);
    chalk2.template.constructor = () => {
      throw new Error("`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.");
    };
    chalk2.template.Instance = ChalkClass;
    return chalk2.template;
  };
  for (const [styleName, style] of Object.entries(ansiStyles)) {
    styles[styleName] = {
      get() {
        const builder = createBuilder(this, createStyler(style.open, style.close, this._styler), this._isEmpty);
        Object.defineProperty(this, styleName, { value: builder });
        return builder;
      },
    };
  }
  styles.visible = {
    get() {
      const builder = createBuilder(this, this._styler, true);
      Object.defineProperty(this, "visible", { value: builder });
      return builder;
    },
  };
  var usedModels = ["rgb", "hex", "keyword", "hsl", "hsv", "hwb", "ansi", "ansi256"];
  for (const model of usedModels) {
    styles[model] = {
      get() {
        const { level } = this;
        return function (...arguments_) {
          const styler = createStyler(
            ansiStyles.color[levelMapping[level]][model](...arguments_),
            ansiStyles.color.close,
            this._styler
          );
          return createBuilder(this, styler, this._isEmpty);
        };
      },
    };
  }
  for (const model of usedModels) {
    const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
    styles[bgModel] = {
      get() {
        const { level } = this;
        return function (...arguments_) {
          const styler = createStyler(
            ansiStyles.bgColor[levelMapping[level]][model](...arguments_),
            ansiStyles.bgColor.close,
            this._styler
          );
          return createBuilder(this, styler, this._isEmpty);
        };
      },
    };
  }
  var proto = Object.defineProperties(() => {}, {
    ...styles,
    level: {
      enumerable: true,
      get() {
        return this._generator.level;
      },
      set(level) {
        this._generator.level = level;
      },
    },
  });
  var createStyler = (open, close, parent) => {
    let openAll;
    let closeAll;
    if (parent === undefined) {
      openAll = open;
      closeAll = close;
    } else {
      openAll = parent.openAll + open;
      closeAll = close + parent.closeAll;
    }
    return {
      open,
      close,
      openAll,
      closeAll,
      parent,
    };
  };
  var createBuilder = (self, _styler, _isEmpty) => {
    const builder = (...arguments_) => {
      if (isArray(arguments_[0]) && isArray(arguments_[0].raw)) {
        return applyStyle(builder, chalkTag(builder, ...arguments_));
      }
      return applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
    };
    Object.setPrototypeOf(builder, proto);
    builder._generator = self;
    builder._styler = _styler;
    builder._isEmpty = _isEmpty;
    return builder;
  };
  var applyStyle = (self, string) => {
    if (self.level <= 0 || !string) {
      return self._isEmpty ? "" : string;
    }
    let styler = self._styler;
    if (styler === undefined) {
      return string;
    }
    const { openAll, closeAll } = styler;
    if (string.indexOf("\x1B") !== -1) {
      while (styler !== undefined) {
        string = stringReplaceAll(string, styler.close, styler.open);
        styler = styler.parent;
      }
    }
    const lfIndex = string.indexOf("\n");
    if (lfIndex !== -1) {
      string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
    }
    return openAll + string + closeAll;
  };
  var template;
  var chalkTag = (chalk2, ...strings) => {
    const [firstString] = strings;
    if (!isArray(firstString) || !isArray(firstString.raw)) {
      return strings.join(" ");
    }
    const arguments_ = strings.slice(1);
    const parts = [firstString.raw[0]];
    for (let i = 1; i < firstString.length; i++) {
      parts.push(String(arguments_[i - 1]).replace(/[{}\\]/g, "\\$&"), String(firstString.raw[i]));
    }
    if (template === undefined) {
      template = require_templates();
    }
    return template(chalk2, parts.join(""));
  };
  Object.defineProperties(Chalk.prototype, styles);
  var chalk = Chalk();
  chalk.supportsColor = stdoutColor;
  chalk.stderr = Chalk({ level: stderrColor ? stderrColor.level : 0 });
  chalk.stderr.supportsColor = stderrColor;
  module.exports = chalk;
});

// node_modules/tsconfig-paths/lib/filesystem.js
var require_filesystem = __commonJS((exports) => {
  function fileExistsSync(path) {
    if (!fs.existsSync(path)) {
      return false;
    }
    try {
      var stats = fs.statSync(path);
      return stats.isFile();
    } catch (err) {
      return false;
    }
  }
  function readJsonFromDiskSync(packageJsonPath) {
    if (!fs.existsSync(packageJsonPath)) {
      return;
    }
    return __require(packageJsonPath);
  }
  function readJsonFromDiskAsync(path, callback) {
    fs.readFile(path, "utf8", function (err, result) {
      if (err || !result) {
        return callback();
      }
      var json = JSON.parse(result);
      return callback(undefined, json);
    });
  }
  function fileExistsAsync(path2, callback2) {
    fs.stat(path2, function (err, stats) {
      if (err) {
        return callback2(undefined, false);
      }
      callback2(undefined, stats ? stats.isFile() : false);
    });
  }
  function removeExtension(path) {
    return path.substring(0, path.lastIndexOf(".")) || path;
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.removeExtension =
    exports.fileExistsAsync =
    exports.readJsonFromDiskAsync =
    exports.readJsonFromDiskSync =
    exports.fileExistsSync =
      undefined;
  var fs = __require("fs");
  exports.fileExistsSync = fileExistsSync;
  exports.readJsonFromDiskSync = readJsonFromDiskSync;
  exports.readJsonFromDiskAsync = readJsonFromDiskAsync;
  exports.fileExistsAsync = fileExistsAsync;
  exports.removeExtension = removeExtension;
});

// node_modules/tsconfig-paths/lib/mapping-entry.js
var require_mapping_entry = __commonJS((exports) => {
  function getAbsoluteMappingEntries(absoluteBaseUrl, paths, addMatchAll) {
    var sortedKeys = sortByLongestPrefix(Object.keys(paths));
    var absolutePaths = [];
    for (var _i = 0, sortedKeys_1 = sortedKeys; _i < sortedKeys_1.length; _i++) {
      var key = sortedKeys_1[_i];
      absolutePaths.push({
        pattern: key,
        paths: paths[key].map(function (pathToResolve) {
          return path.resolve(absoluteBaseUrl, pathToResolve);
        }),
      });
    }
    if (!paths["*"] && addMatchAll) {
      absolutePaths.push({
        pattern: "*",
        paths: ["".concat(absoluteBaseUrl.replace(/\/$/, ""), "/*")],
      });
    }
    return absolutePaths;
  }
  function sortByLongestPrefix(arr) {
    return arr.concat().sort(function (a, b) {
      return getPrefixLength(b) - getPrefixLength(a);
    });
  }
  function getPrefixLength(pattern) {
    var prefixLength = pattern.indexOf("*");
    return pattern.substr(0, prefixLength).length;
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.getAbsoluteMappingEntries = undefined;
  var path = __require("path");
  exports.getAbsoluteMappingEntries = getAbsoluteMappingEntries;
});

// node_modules/tsconfig-paths/lib/try-path.js
var require_try_path = __commonJS((exports) => {
  function getPathsToTry(extensions, absolutePathMappings, requestedModule) {
    if (!absolutePathMappings || !requestedModule || requestedModule[0] === ".") {
      return;
    }
    var pathsToTry = [];
    for (var _i = 0, absolutePathMappings_1 = absolutePathMappings; _i < absolutePathMappings_1.length; _i++) {
      var entry = absolutePathMappings_1[_i];
      var starMatch = entry.pattern === requestedModule ? "" : matchStar(entry.pattern, requestedModule);
      if (starMatch !== undefined) {
        var _loop_1 = function (physicalPathPattern2) {
          var physicalPath = physicalPathPattern2.replace("*", starMatch);
          pathsToTry.push({ type: "file", path: physicalPath });
          pathsToTry.push.apply(
            pathsToTry,
            extensions.map(function (e) {
              return { type: "extension", path: physicalPath + e };
            })
          );
          pathsToTry.push({
            type: "package",
            path: path.join(physicalPath, "/package.json"),
          });
          var indexPath = path.join(physicalPath, "/index");
          pathsToTry.push.apply(
            pathsToTry,
            extensions.map(function (e) {
              return { type: "index", path: indexPath + e };
            })
          );
        };
        for (var _a = 0, _b = entry.paths; _a < _b.length; _a++) {
          var physicalPathPattern = _b[_a];
          _loop_1(physicalPathPattern);
        }
      }
    }
    return pathsToTry.length === 0 ? undefined : pathsToTry;
  }
  function getStrippedPath(tryPath) {
    return tryPath.type === "index"
      ? (0, path_1.dirname)(tryPath.path)
      : tryPath.type === "file"
        ? tryPath.path
        : tryPath.type === "extension"
          ? (0, filesystem_1.removeExtension)(tryPath.path)
          : tryPath.type === "package"
            ? tryPath.path
            : exhaustiveTypeException(tryPath.type);
  }
  function exhaustiveTypeException(check) {
    throw new Error("Unknown type ".concat(check));
  }
  function matchStar(pattern, search) {
    if (search.length < pattern.length) {
      return;
    }
    if (pattern === "*") {
      return search;
    }
    var star = pattern.indexOf("*");
    if (star === -1) {
      return;
    }
    var part1 = pattern.substring(0, star);
    var part2 = pattern.substring(star + 1);
    if (search.substr(0, star) !== part1) {
      return;
    }
    if (search.substr(search.length - part2.length) !== part2) {
      return;
    }
    return search.substr(star, search.length - part2.length);
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.exhaustiveTypeException = exports.getStrippedPath = exports.getPathsToTry = undefined;
  var path = __require("path");
  var path_1 = __require("path");
  var filesystem_1 = require_filesystem();
  exports.getPathsToTry = getPathsToTry;
  exports.getStrippedPath = getStrippedPath;
  exports.exhaustiveTypeException = exhaustiveTypeException;
});

// node_modules/tsconfig-paths/lib/match-path-sync.js
var require_match_path_sync = __commonJS((exports) => {
  function createMatchPath(absoluteBaseUrl, paths, mainFields, addMatchAll) {
    if (mainFields === undefined) {
      mainFields = ["main"];
    }
    if (addMatchAll === undefined) {
      addMatchAll = true;
    }
    var absolutePaths = MappingEntry.getAbsoluteMappingEntries(absoluteBaseUrl, paths, addMatchAll);
    return function (requestedModule, readJson, fileExists, extensions) {
      return matchFromAbsolutePaths(absolutePaths, requestedModule, readJson, fileExists, extensions, mainFields);
    };
  }
  function matchFromAbsolutePaths(absolutePathMappings, requestedModule, readJson, fileExists, extensions, mainFields) {
    if (readJson === undefined) {
      readJson = Filesystem.readJsonFromDiskSync;
    }
    if (fileExists === undefined) {
      fileExists = Filesystem.fileExistsSync;
    }
    if (extensions === undefined) {
      extensions = Object.keys(__require.extensions);
    }
    if (mainFields === undefined) {
      mainFields = ["main"];
    }
    var tryPaths = TryPath.getPathsToTry(extensions, absolutePathMappings, requestedModule);
    if (!tryPaths) {
      return;
    }
    return findFirstExistingPath(tryPaths, readJson, fileExists, mainFields);
  }
  function findFirstExistingMainFieldMappedFile(packageJson, mainFields, packageJsonPath, fileExists) {
    for (var index = 0; index < mainFields.length; index++) {
      var mainFieldSelector = mainFields[index];
      var candidateMapping =
        typeof mainFieldSelector === "string"
          ? packageJson[mainFieldSelector]
          : mainFieldSelector.reduce(function (obj, key) {
              return obj[key];
            }, packageJson);
      if (candidateMapping && typeof candidateMapping === "string") {
        var candidateFilePath = path.join(path.dirname(packageJsonPath), candidateMapping);
        if (fileExists(candidateFilePath)) {
          return candidateFilePath;
        }
      }
    }
    return;
  }
  function findFirstExistingPath(tryPaths, readJson, fileExists, mainFields) {
    if (readJson === undefined) {
      readJson = Filesystem.readJsonFromDiskSync;
    }
    if (mainFields === undefined) {
      mainFields = ["main"];
    }
    for (var _i = 0, tryPaths_1 = tryPaths; _i < tryPaths_1.length; _i++) {
      var tryPath = tryPaths_1[_i];
      if (tryPath.type === "file" || tryPath.type === "extension" || tryPath.type === "index") {
        if (fileExists(tryPath.path)) {
          return TryPath.getStrippedPath(tryPath);
        }
      } else if (tryPath.type === "package") {
        var packageJson = readJson(tryPath.path);
        if (packageJson) {
          var mainFieldMappedFile = findFirstExistingMainFieldMappedFile(
            packageJson,
            mainFields,
            tryPath.path,
            fileExists
          );
          if (mainFieldMappedFile) {
            return mainFieldMappedFile;
          }
        }
      } else {
        TryPath.exhaustiveTypeException(tryPath.type);
      }
    }
    return;
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.matchFromAbsolutePaths = exports.createMatchPath = undefined;
  var path = __require("path");
  var Filesystem = require_filesystem();
  var MappingEntry = require_mapping_entry();
  var TryPath = require_try_path();
  exports.createMatchPath = createMatchPath;
  exports.matchFromAbsolutePaths = matchFromAbsolutePaths;
});

// node_modules/tsconfig-paths/lib/match-path-async.js
var require_match_path_async = __commonJS((exports) => {
  function createMatchPathAsync(absoluteBaseUrl, paths, mainFields, addMatchAll) {
    if (mainFields === undefined) {
      mainFields = ["main"];
    }
    if (addMatchAll === undefined) {
      addMatchAll = true;
    }
    var absolutePaths = MappingEntry.getAbsoluteMappingEntries(absoluteBaseUrl, paths, addMatchAll);
    return function (requestedModule, readJson, fileExists, extensions, callback) {
      return matchFromAbsolutePathsAsync(
        absolutePaths,
        requestedModule,
        readJson,
        fileExists,
        extensions,
        callback,
        mainFields
      );
    };
  }
  function matchFromAbsolutePathsAsync(
    absolutePathMappings,
    requestedModule,
    readJson,
    fileExists,
    extensions,
    callback,
    mainFields
  ) {
    if (readJson === undefined) {
      readJson = Filesystem.readJsonFromDiskAsync;
    }
    if (fileExists === undefined) {
      fileExists = Filesystem.fileExistsAsync;
    }
    if (extensions === undefined) {
      extensions = Object.keys(__require.extensions);
    }
    if (mainFields === undefined) {
      mainFields = ["main"];
    }
    var tryPaths = TryPath.getPathsToTry(extensions, absolutePathMappings, requestedModule);
    if (!tryPaths) {
      return callback();
    }
    findFirstExistingPath(tryPaths, readJson, fileExists, callback, 0, mainFields);
  }
  function findFirstExistingMainFieldMappedFile(
    packageJson,
    mainFields,
    packageJsonPath,
    fileExistsAsync,
    doneCallback,
    index
  ) {
    if (index === undefined) {
      index = 0;
    }
    if (index >= mainFields.length) {
      return doneCallback(undefined, undefined);
    }
    var tryNext = function () {
      return findFirstExistingMainFieldMappedFile(
        packageJson,
        mainFields,
        packageJsonPath,
        fileExistsAsync,
        doneCallback,
        index + 1
      );
    };
    var mainFieldSelector = mainFields[index];
    var mainFieldMapping =
      typeof mainFieldSelector === "string"
        ? packageJson[mainFieldSelector]
        : mainFieldSelector.reduce(function (obj, key) {
            return obj[key];
          }, packageJson);
    if (typeof mainFieldMapping !== "string") {
      return tryNext();
    }
    var mappedFilePath = path.join(path.dirname(packageJsonPath), mainFieldMapping);
    fileExistsAsync(mappedFilePath, function (err, exists) {
      if (err) {
        return doneCallback(err);
      }
      if (exists) {
        return doneCallback(undefined, mappedFilePath);
      }
      return tryNext();
    });
  }
  function findFirstExistingPath(tryPaths, readJson, fileExists, doneCallback, index, mainFields) {
    if (index === undefined) {
      index = 0;
    }
    if (mainFields === undefined) {
      mainFields = ["main"];
    }
    var tryPath = tryPaths[index];
    if (tryPath.type === "file" || tryPath.type === "extension" || tryPath.type === "index") {
      fileExists(tryPath.path, function (err, exists) {
        if (err) {
          return doneCallback(err);
        }
        if (exists) {
          return doneCallback(undefined, TryPath.getStrippedPath(tryPath));
        }
        if (index === tryPaths.length - 1) {
          return doneCallback();
        }
        return findFirstExistingPath(tryPaths, readJson, fileExists, doneCallback, index + 1, mainFields);
      });
    } else if (tryPath.type === "package") {
      readJson(tryPath.path, function (err, packageJson) {
        if (err) {
          return doneCallback(err);
        }
        if (packageJson) {
          return findFirstExistingMainFieldMappedFile(
            packageJson,
            mainFields,
            tryPath.path,
            fileExists,
            function (mainFieldErr, mainFieldMappedFile) {
              if (mainFieldErr) {
                return doneCallback(mainFieldErr);
              }
              if (mainFieldMappedFile) {
                return doneCallback(undefined, mainFieldMappedFile);
              }
              return findFirstExistingPath(tryPaths, readJson, fileExists, doneCallback, index + 1, mainFields);
            }
          );
        }
        return findFirstExistingPath(tryPaths, readJson, fileExists, doneCallback, index + 1, mainFields);
      });
    } else {
      TryPath.exhaustiveTypeException(tryPath.type);
    }
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.matchFromAbsolutePathsAsync = exports.createMatchPathAsync = undefined;
  var path = __require("path");
  var TryPath = require_try_path();
  var MappingEntry = require_mapping_entry();
  var Filesystem = require_filesystem();
  exports.createMatchPathAsync = createMatchPathAsync;
  exports.matchFromAbsolutePathsAsync = matchFromAbsolutePathsAsync;
});

// node_modules/minimist/index.js
var require_minimist = __commonJS((exports, module) => {
  function hasKey(obj, keys) {
    var o = obj;
    keys.slice(0, -1).forEach(function (key2) {
      o = o[key2] || {};
    });
    var key = keys[keys.length - 1];
    return key in o;
  }
  function isNumber(x) {
    if (typeof x === "number") {
      return true;
    }
    if (/^0x[0-9a-f]+$/i.test(x)) {
      return true;
    }
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
  }
  function isConstructorOrProto(obj, key) {
    return (key === "constructor" && typeof obj[key] === "function") || key === "__proto__";
  }
  module.exports = function (args, opts) {
    if (!opts) {
      opts = {};
    }
    var flags = {
      bools: {},
      strings: {},
      unknownFn: null,
    };
    if (typeof opts.unknown === "function") {
      flags.unknownFn = opts.unknown;
    }
    if (typeof opts.boolean === "boolean" && opts.boolean) {
      flags.allBools = true;
    } else {
      []
        .concat(opts.boolean)
        .filter(Boolean)
        .forEach(function (key2) {
          flags.bools[key2] = true;
        });
    }
    var aliases = {};
    function aliasIsBoolean(key2) {
      return aliases[key2].some(function (x) {
        return flags.bools[x];
      });
    }
    Object.keys(opts.alias || {}).forEach(function (key2) {
      aliases[key2] = [].concat(opts.alias[key2]);
      aliases[key2].forEach(function (x) {
        aliases[x] = [key2].concat(
          aliases[key2].filter(function (y) {
            return x !== y;
          })
        );
      });
    });
    []
      .concat(opts.string)
      .filter(Boolean)
      .forEach(function (key2) {
        flags.strings[key2] = true;
        if (aliases[key2]) {
          [].concat(aliases[key2]).forEach(function (k) {
            flags.strings[k] = true;
          });
        }
      });
    var defaults = opts.default || {};
    var argv = { _: [] };
    function argDefined(key2, arg2) {
      return (flags.allBools && /^--[^=]+$/.test(arg2)) || flags.strings[key2] || flags.bools[key2] || aliases[key2];
    }
    function setKey(obj, keys, value2) {
      var o = obj;
      for (var i2 = 0; i2 < keys.length - 1; i2++) {
        var key2 = keys[i2];
        if (isConstructorOrProto(o, key2)) {
          return;
        }
        if (o[key2] === undefined) {
          o[key2] = {};
        }
        if (o[key2] === Object.prototype || o[key2] === Number.prototype || o[key2] === String.prototype) {
          o[key2] = {};
        }
        if (o[key2] === Array.prototype) {
          o[key2] = [];
        }
        o = o[key2];
      }
      var lastKey = keys[keys.length - 1];
      if (isConstructorOrProto(o, lastKey)) {
        return;
      }
      if (o === Object.prototype || o === Number.prototype || o === String.prototype) {
        o = {};
      }
      if (o === Array.prototype) {
        o = [];
      }
      if (o[lastKey] === undefined || flags.bools[lastKey] || typeof o[lastKey] === "boolean") {
        o[lastKey] = value2;
      } else if (Array.isArray(o[lastKey])) {
        o[lastKey].push(value2);
      } else {
        o[lastKey] = [o[lastKey], value2];
      }
    }
    function setArg(key2, val, arg2) {
      if (arg2 && flags.unknownFn && !argDefined(key2, arg2)) {
        if (flags.unknownFn(arg2) === false) {
          return;
        }
      }
      var value2 = !flags.strings[key2] && isNumber(val) ? Number(val) : val;
      setKey(argv, key2.split("."), value2);
      (aliases[key2] || []).forEach(function (x) {
        setKey(argv, x.split("."), value2);
      });
    }
    Object.keys(flags.bools).forEach(function (key2) {
      setArg(key2, defaults[key2] === undefined ? false : defaults[key2]);
    });
    var notFlags = [];
    if (args.indexOf("--") !== -1) {
      notFlags = args.slice(args.indexOf("--") + 1);
      args = args.slice(0, args.indexOf("--"));
    }
    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
      var key;
      var next;
      if (/^--.+=/.test(arg)) {
        var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
        key = m[1];
        var value = m[2];
        if (flags.bools[key]) {
          value = value !== "false";
        }
        setArg(key, value, arg);
      } else if (/^--no-.+/.test(arg)) {
        key = arg.match(/^--no-(.+)/)[1];
        setArg(key, false, arg);
      } else if (/^--.+/.test(arg)) {
        key = arg.match(/^--(.+)/)[1];
        next = args[i + 1];
        if (
          next !== undefined &&
          !/^(-|--)[^-]/.test(next) &&
          !flags.bools[key] &&
          !flags.allBools &&
          (aliases[key] ? !aliasIsBoolean(key) : true)
        ) {
          setArg(key, next, arg);
          i += 1;
        } else if (/^(true|false)$/.test(next)) {
          setArg(key, next === "true", arg);
          i += 1;
        } else {
          setArg(key, flags.strings[key] ? "" : true, arg);
        }
      } else if (/^-[^-]+/.test(arg)) {
        var letters = arg.slice(1, -1).split("");
        var broken = false;
        for (var j = 0; j < letters.length; j++) {
          next = arg.slice(j + 2);
          if (next === "-") {
            setArg(letters[j], next, arg);
            continue;
          }
          if (/[A-Za-z]/.test(letters[j]) && next[0] === "=") {
            setArg(letters[j], next.slice(1), arg);
            broken = true;
            break;
          }
          if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
            setArg(letters[j], next, arg);
            broken = true;
            break;
          }
          if (letters[j + 1] && letters[j + 1].match(/\W/)) {
            setArg(letters[j], arg.slice(j + 2), arg);
            broken = true;
            break;
          } else {
            setArg(letters[j], flags.strings[letters[j]] ? "" : true, arg);
          }
        }
        key = arg.slice(-1)[0];
        if (!broken && key !== "-") {
          if (
            args[i + 1] &&
            !/^(-|--)[^-]/.test(args[i + 1]) &&
            !flags.bools[key] &&
            (aliases[key] ? !aliasIsBoolean(key) : true)
          ) {
            setArg(key, args[i + 1], arg);
            i += 1;
          } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
            setArg(key, args[i + 1] === "true", arg);
            i += 1;
          } else {
            setArg(key, flags.strings[key] ? "" : true, arg);
          }
        }
      } else {
        if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
          argv._.push(flags.strings._ || !isNumber(arg) ? arg : Number(arg));
        }
        if (opts.stopEarly) {
          argv._.push.apply(argv._, args.slice(i + 1));
          break;
        }
      }
    }
    Object.keys(defaults).forEach(function (k) {
      if (!hasKey(argv, k.split("."))) {
        setKey(argv, k.split("."), defaults[k]);
        (aliases[k] || []).forEach(function (x) {
          setKey(argv, x.split("."), defaults[k]);
        });
      }
    });
    if (opts["--"]) {
      argv["--"] = notFlags.slice();
    } else {
      notFlags.forEach(function (k) {
        argv._.push(k);
      });
    }
    return argv;
  };
});

// node_modules/json5/lib/unicode.js
var require_unicode = __commonJS((exports, module) => {
  exports.Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
  exports.ID_Start =
    /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
  exports.ID_Continue =
    /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
});

// node_modules/json5/lib/util.js
var require_util2 = __commonJS((exports, module) => {
  var unicode = require_unicode();
  module.exports = {
    isSpaceSeparator(c) {
      return typeof c === "string" && unicode.Space_Separator.test(c);
    },
    isIdStartChar(c) {
      return (
        typeof c === "string" &&
        ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "$" || c === "_" || unicode.ID_Start.test(c))
      );
    },
    isIdContinueChar(c) {
      return (
        typeof c === "string" &&
        ((c >= "a" && c <= "z") ||
          (c >= "A" && c <= "Z") ||
          (c >= "0" && c <= "9") ||
          c === "$" ||
          c === "_" ||
          c === "\u200C" ||
          c === "\u200D" ||
          unicode.ID_Continue.test(c))
      );
    },
    isDigit(c) {
      return typeof c === "string" && /[0-9]/.test(c);
    },
    isHexDigit(c) {
      return typeof c === "string" && /[0-9A-Fa-f]/.test(c);
    },
  };
});

// node_modules/json5/lib/parse.js
var require_parse = __commonJS((exports, module) => {
  function internalize(holder, name, reviver) {
    const value = holder[name];
    if (value != null && typeof value === "object") {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const key2 = String(i);
          const replacement = internalize(value, key2, reviver);
          if (replacement === undefined) {
            delete value[key2];
          } else {
            Object.defineProperty(value, key2, {
              value: replacement,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          }
        }
      } else {
        for (const key2 in value) {
          const replacement = internalize(value, key2, reviver);
          if (replacement === undefined) {
            delete value[key2];
          } else {
            Object.defineProperty(value, key2, {
              value: replacement,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          }
        }
      }
    }
    return reviver.call(holder, name, value);
  }
  function lex() {
    lexState = "default";
    buffer = "";
    doubleQuote = false;
    sign = 1;
    for (;;) {
      c = peek();
      const token2 = lexStates[lexState]();
      if (token2) {
        return token2;
      }
    }
  }
  function peek() {
    if (source[pos]) {
      return String.fromCodePoint(source.codePointAt(pos));
    }
  }
  function read() {
    const c2 = peek();
    if (c2 === "\n") {
      line++;
      column = 0;
    } else if (c2) {
      column += c2.length;
    } else {
      column++;
    }
    if (c2) {
      pos += c2.length;
    }
    return c2;
  }
  function newToken(type, value) {
    return {
      type,
      value,
      line,
      column,
    };
  }
  function literal(s) {
    for (const c2 of s) {
      const p = peek();
      if (p !== c2) {
        throw invalidChar(read());
      }
      read();
    }
  }
  function escape() {
    const c2 = peek();
    switch (c2) {
      case "b":
        read();
        return "\b";
      case "f":
        read();
        return "\f";
      case "n":
        read();
        return "\n";
      case "r":
        read();
        return "\r";
      case "t":
        read();
        return "\t";
      case "v":
        read();
        return "\v";
      case "0":
        read();
        if (util.isDigit(peek())) {
          throw invalidChar(read());
        }
        return "\0";
      case "x":
        read();
        return hexEscape();
      case "u":
        read();
        return unicodeEscape();
      case "\n":
      case "\u2028":
      case "\u2029":
        read();
        return "";
      case "\r":
        read();
        if (peek() === "\n") {
          read();
        }
        return "";
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        throw invalidChar(read());
      case undefined:
        throw invalidChar(read());
    }
    return read();
  }
  function hexEscape() {
    let buffer2 = "";
    let c2 = peek();
    if (!util.isHexDigit(c2)) {
      throw invalidChar(read());
    }
    buffer2 += read();
    c2 = peek();
    if (!util.isHexDigit(c2)) {
      throw invalidChar(read());
    }
    buffer2 += read();
    return String.fromCodePoint(parseInt(buffer2, 16));
  }
  function unicodeEscape() {
    let buffer2 = "";
    let count = 4;
    while (count-- > 0) {
      const c2 = peek();
      if (!util.isHexDigit(c2)) {
        throw invalidChar(read());
      }
      buffer2 += read();
    }
    return String.fromCodePoint(parseInt(buffer2, 16));
  }
  function push() {
    let value;
    switch (token.type) {
      case "punctuator":
        switch (token.value) {
          case "{":
            value = {};
            break;
          case "[":
            value = [];
            break;
        }
        break;
      case "null":
      case "boolean":
      case "numeric":
      case "string":
        value = token.value;
        break;
    }
    if (root === undefined) {
      root = value;
    } else {
      const parent = stack[stack.length - 1];
      if (Array.isArray(parent)) {
        parent.push(value);
      } else {
        Object.defineProperty(parent, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    if (value !== null && typeof value === "object") {
      stack.push(value);
      if (Array.isArray(value)) {
        parseState = "beforeArrayValue";
      } else {
        parseState = "beforePropertyName";
      }
    } else {
      const current = stack[stack.length - 1];
      if (current == null) {
        parseState = "end";
      } else if (Array.isArray(current)) {
        parseState = "afterArrayValue";
      } else {
        parseState = "afterPropertyValue";
      }
    }
  }
  function pop() {
    stack.pop();
    const current = stack[stack.length - 1];
    if (current == null) {
      parseState = "end";
    } else if (Array.isArray(current)) {
      parseState = "afterArrayValue";
    } else {
      parseState = "afterPropertyValue";
    }
  }
  function invalidChar(c2) {
    if (c2 === undefined) {
      return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
    }
    return syntaxError(`JSON5: invalid character '${formatChar(c2)}' at ${line}:${column}`);
  }
  function invalidEOF() {
    return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
  }
  function invalidIdentifier() {
    column -= 5;
    return syntaxError(`JSON5: invalid identifier character at ${line}:${column}`);
  }
  function separatorChar(c2) {
    console.warn(`JSON5: '${formatChar(c2)}' in strings is not valid ECMAScript; consider escaping`);
  }
  function formatChar(c2) {
    const replacements = {
      "'": "\\'",
      '"': '\\"',
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "\t": "\\t",
      "\v": "\\v",
      "\0": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029",
    };
    if (replacements[c2]) {
      return replacements[c2];
    }
    if (c2 < " ") {
      const hexString = c2.charCodeAt(0).toString(16);
      return "\\x" + ("00" + hexString).substring(hexString.length);
    }
    return c2;
  }
  function syntaxError(message) {
    const err = new SyntaxError(message);
    err.lineNumber = line;
    err.columnNumber = column;
    return err;
  }
  var util = require_util2();
  var source;
  var parseState;
  var stack;
  var pos;
  var line;
  var column;
  var token;
  var key;
  var root;
  module.exports = function parse(text, reviver) {
    source = String(text);
    parseState = "start";
    stack = [];
    pos = 0;
    line = 1;
    column = 0;
    token = undefined;
    key = undefined;
    root = undefined;
    do {
      token = lex();
      parseStates[parseState]();
    } while (token.type !== "eof");
    if (typeof reviver === "function") {
      return internalize({ "": root }, "", reviver);
    }
    return root;
  };
  var lexState;
  var buffer;
  var doubleQuote;
  var sign;
  var c;
  var lexStates = {
    default() {
      switch (c) {
        case "\t":
        case "\v":
        case "\f":
        case " ":
        case "\xA0":
        case "\uFEFF":
        case "\n":
        case "\r":
        case "\u2028":
        case "\u2029":
          read();
          return;
        case "/":
          read();
          lexState = "comment";
          return;
        case undefined:
          read();
          return newToken("eof");
      }
      if (util.isSpaceSeparator(c)) {
        read();
        return;
      }
      return lexStates[parseState]();
    },
    comment() {
      switch (c) {
        case "*":
          read();
          lexState = "multiLineComment";
          return;
        case "/":
          read();
          lexState = "singleLineComment";
          return;
      }
      throw invalidChar(read());
    },
    multiLineComment() {
      switch (c) {
        case "*":
          read();
          lexState = "multiLineCommentAsterisk";
          return;
        case undefined:
          throw invalidChar(read());
      }
      read();
    },
    multiLineCommentAsterisk() {
      switch (c) {
        case "*":
          read();
          return;
        case "/":
          read();
          lexState = "default";
          return;
        case undefined:
          throw invalidChar(read());
      }
      read();
      lexState = "multiLineComment";
    },
    singleLineComment() {
      switch (c) {
        case "\n":
        case "\r":
        case "\u2028":
        case "\u2029":
          read();
          lexState = "default";
          return;
        case undefined:
          read();
          return newToken("eof");
      }
      read();
    },
    value() {
      switch (c) {
        case "{":
        case "[":
          return newToken("punctuator", read());
        case "n":
          read();
          literal("ull");
          return newToken("null", null);
        case "t":
          read();
          literal("rue");
          return newToken("boolean", true);
        case "f":
          read();
          literal("alse");
          return newToken("boolean", false);
        case "-":
        case "+":
          if (read() === "-") {
            sign = -1;
          }
          lexState = "sign";
          return;
        case ".":
          buffer = read();
          lexState = "decimalPointLeading";
          return;
        case "0":
          buffer = read();
          lexState = "zero";
          return;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          buffer = read();
          lexState = "decimalInteger";
          return;
        case "I":
          read();
          literal("nfinity");
          return newToken("numeric", Infinity);
        case "N":
          read();
          literal("aN");
          return newToken("numeric", NaN);
        case '"':
        case "'":
          doubleQuote = read() === '"';
          buffer = "";
          lexState = "string";
          return;
      }
      throw invalidChar(read());
    },
    identifierNameStartEscape() {
      if (c !== "u") {
        throw invalidChar(read());
      }
      read();
      const u = unicodeEscape();
      switch (u) {
        case "$":
        case "_":
          break;
        default:
          if (!util.isIdStartChar(u)) {
            throw invalidIdentifier();
          }
          break;
      }
      buffer += u;
      lexState = "identifierName";
    },
    identifierName() {
      switch (c) {
        case "$":
        case "_":
        case "\u200C":
        case "\u200D":
          buffer += read();
          return;
        case "\\":
          read();
          lexState = "identifierNameEscape";
          return;
      }
      if (util.isIdContinueChar(c)) {
        buffer += read();
        return;
      }
      return newToken("identifier", buffer);
    },
    identifierNameEscape() {
      if (c !== "u") {
        throw invalidChar(read());
      }
      read();
      const u = unicodeEscape();
      switch (u) {
        case "$":
        case "_":
        case "\u200C":
        case "\u200D":
          break;
        default:
          if (!util.isIdContinueChar(u)) {
            throw invalidIdentifier();
          }
          break;
      }
      buffer += u;
      lexState = "identifierName";
    },
    sign() {
      switch (c) {
        case ".":
          buffer = read();
          lexState = "decimalPointLeading";
          return;
        case "0":
          buffer = read();
          lexState = "zero";
          return;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          buffer = read();
          lexState = "decimalInteger";
          return;
        case "I":
          read();
          literal("nfinity");
          return newToken("numeric", sign * Infinity);
        case "N":
          read();
          literal("aN");
          return newToken("numeric", NaN);
      }
      throw invalidChar(read());
    },
    zero() {
      switch (c) {
        case ".":
          buffer += read();
          lexState = "decimalPoint";
          return;
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
        case "x":
        case "X":
          buffer += read();
          lexState = "hexadecimal";
          return;
      }
      return newToken("numeric", sign * 0);
    },
    decimalInteger() {
      switch (c) {
        case ".":
          buffer += read();
          lexState = "decimalPoint";
          return;
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    decimalPointLeading() {
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalFraction";
        return;
      }
      throw invalidChar(read());
    },
    decimalPoint() {
      switch (c) {
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalFraction";
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    decimalFraction() {
      switch (c) {
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    decimalExponent() {
      switch (c) {
        case "+":
        case "-":
          buffer += read();
          lexState = "decimalExponentSign";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalExponentInteger";
        return;
      }
      throw invalidChar(read());
    },
    decimalExponentSign() {
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalExponentInteger";
        return;
      }
      throw invalidChar(read());
    },
    decimalExponentInteger() {
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    hexadecimal() {
      if (util.isHexDigit(c)) {
        buffer += read();
        lexState = "hexadecimalInteger";
        return;
      }
      throw invalidChar(read());
    },
    hexadecimalInteger() {
      if (util.isHexDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    string() {
      switch (c) {
        case "\\":
          read();
          buffer += escape();
          return;
        case '"':
          if (doubleQuote) {
            read();
            return newToken("string", buffer);
          }
          buffer += read();
          return;
        case "'":
          if (!doubleQuote) {
            read();
            return newToken("string", buffer);
          }
          buffer += read();
          return;
        case "\n":
        case "\r":
          throw invalidChar(read());
        case "\u2028":
        case "\u2029":
          separatorChar(c);
          break;
        case undefined:
          throw invalidChar(read());
      }
      buffer += read();
    },
    start() {
      switch (c) {
        case "{":
        case "[":
          return newToken("punctuator", read());
      }
      lexState = "value";
    },
    beforePropertyName() {
      switch (c) {
        case "$":
        case "_":
          buffer = read();
          lexState = "identifierName";
          return;
        case "\\":
          read();
          lexState = "identifierNameStartEscape";
          return;
        case "}":
          return newToken("punctuator", read());
        case '"':
        case "'":
          doubleQuote = read() === '"';
          lexState = "string";
          return;
      }
      if (util.isIdStartChar(c)) {
        buffer += read();
        lexState = "identifierName";
        return;
      }
      throw invalidChar(read());
    },
    afterPropertyName() {
      if (c === ":") {
        return newToken("punctuator", read());
      }
      throw invalidChar(read());
    },
    beforePropertyValue() {
      lexState = "value";
    },
    afterPropertyValue() {
      switch (c) {
        case ",":
        case "}":
          return newToken("punctuator", read());
      }
      throw invalidChar(read());
    },
    beforeArrayValue() {
      if (c === "]") {
        return newToken("punctuator", read());
      }
      lexState = "value";
    },
    afterArrayValue() {
      switch (c) {
        case ",":
        case "]":
          return newToken("punctuator", read());
      }
      throw invalidChar(read());
    },
    end() {
      throw invalidChar(read());
    },
  };
  var parseStates = {
    start() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      push();
    },
    beforePropertyName() {
      switch (token.type) {
        case "identifier":
        case "string":
          key = token.value;
          parseState = "afterPropertyName";
          return;
        case "punctuator":
          pop();
          return;
        case "eof":
          throw invalidEOF();
      }
    },
    afterPropertyName() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      parseState = "beforePropertyValue";
    },
    beforePropertyValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      push();
    },
    beforeArrayValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      if (token.type === "punctuator" && token.value === "]") {
        pop();
        return;
      }
      push();
    },
    afterPropertyValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      switch (token.value) {
        case ",":
          parseState = "beforePropertyName";
          return;
        case "}":
          pop();
      }
    },
    afterArrayValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      switch (token.value) {
        case ",":
          parseState = "beforeArrayValue";
          return;
        case "]":
          pop();
      }
    },
    end() {},
  };
});

// node_modules/json5/lib/stringify.js
var require_stringify = __commonJS((exports, module) => {
  var util = require_util2();
  module.exports = function stringify(value, replacer, space) {
    const stack = [];
    let indent = "";
    let propertyList;
    let replacerFunc;
    let gap = "";
    let quote;
    if (replacer != null && typeof replacer === "object" && !Array.isArray(replacer)) {
      space = replacer.space;
      quote = replacer.quote;
      replacer = replacer.replacer;
    }
    if (typeof replacer === "function") {
      replacerFunc = replacer;
    } else if (Array.isArray(replacer)) {
      propertyList = [];
      for (const v of replacer) {
        let item;
        if (typeof v === "string") {
          item = v;
        } else if (typeof v === "number" || v instanceof String || v instanceof Number) {
          item = String(v);
        }
        if (item !== undefined && propertyList.indexOf(item) < 0) {
          propertyList.push(item);
        }
      }
    }
    if (space instanceof Number) {
      space = Number(space);
    } else if (space instanceof String) {
      space = String(space);
    }
    if (typeof space === "number") {
      if (space > 0) {
        space = Math.min(10, Math.floor(space));
        gap = "          ".substr(0, space);
      }
    } else if (typeof space === "string") {
      gap = space.substr(0, 10);
    }
    return serializeProperty("", { "": value });
    function serializeProperty(key, holder) {
      let value2 = holder[key];
      if (value2 != null) {
        if (typeof value2.toJSON5 === "function") {
          value2 = value2.toJSON5(key);
        } else if (typeof value2.toJSON === "function") {
          value2 = value2.toJSON(key);
        }
      }
      if (replacerFunc) {
        value2 = replacerFunc.call(holder, key, value2);
      }
      if (value2 instanceof Number) {
        value2 = Number(value2);
      } else if (value2 instanceof String) {
        value2 = String(value2);
      } else if (value2 instanceof Boolean) {
        value2 = value2.valueOf();
      }
      switch (value2) {
        case null:
          return "null";
        case true:
          return "true";
        case false:
          return "false";
      }
      if (typeof value2 === "string") {
        return quoteString(value2, false);
      }
      if (typeof value2 === "number") {
        return String(value2);
      }
      if (typeof value2 === "object") {
        return Array.isArray(value2) ? serializeArray(value2) : serializeObject(value2);
      }
      return;
    }
    function quoteString(value2) {
      const quotes = {
        "'": 0.1,
        '"': 0.2,
      };
      const replacements = {
        "'": "\\'",
        '"': '\\"',
        "\\": "\\\\",
        "\b": "\\b",
        "\f": "\\f",
        "\n": "\\n",
        "\r": "\\r",
        "\t": "\\t",
        "\v": "\\v",
        "\0": "\\0",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029",
      };
      let product = "";
      for (let i = 0; i < value2.length; i++) {
        const c = value2[i];
        switch (c) {
          case "'":
          case '"':
            quotes[c]++;
            product += c;
            continue;
          case "\0":
            if (util.isDigit(value2[i + 1])) {
              product += "\\x00";
              continue;
            }
        }
        if (replacements[c]) {
          product += replacements[c];
          continue;
        }
        if (c < " ") {
          let hexString = c.charCodeAt(0).toString(16);
          product += "\\x" + ("00" + hexString).substring(hexString.length);
          continue;
        }
        product += c;
      }
      const quoteChar = quote || Object.keys(quotes).reduce((a, b) => (quotes[a] < quotes[b] ? a : b));
      product = product.replace(new RegExp(quoteChar, "g"), replacements[quoteChar]);
      return quoteChar + product + quoteChar;
    }
    function serializeObject(value2) {
      if (stack.indexOf(value2) >= 0) {
        throw TypeError("Converting circular structure to JSON5");
      }
      stack.push(value2);
      let stepback = indent;
      indent = indent + gap;
      let keys = propertyList || Object.keys(value2);
      let partial = [];
      for (const key of keys) {
        const propertyString = serializeProperty(key, value2);
        if (propertyString !== undefined) {
          let member = serializeKey(key) + ":";
          if (gap !== "") {
            member += " ";
          }
          member += propertyString;
          partial.push(member);
        }
      }
      let final;
      if (partial.length === 0) {
        final = "{}";
      } else {
        let properties;
        if (gap === "") {
          properties = partial.join(",");
          final = "{" + properties + "}";
        } else {
          let separator = ",\n" + indent;
          properties = partial.join(separator);
          final = "{\n" + indent + properties + ",\n" + stepback + "}";
        }
      }
      stack.pop();
      indent = stepback;
      return final;
    }
    function serializeKey(key) {
      if (key.length === 0) {
        return quoteString(key, true);
      }
      const firstChar = String.fromCodePoint(key.codePointAt(0));
      if (!util.isIdStartChar(firstChar)) {
        return quoteString(key, true);
      }
      for (let i = firstChar.length; i < key.length; i++) {
        if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
          return quoteString(key, true);
        }
      }
      return key;
    }
    function serializeArray(value2) {
      if (stack.indexOf(value2) >= 0) {
        throw TypeError("Converting circular structure to JSON5");
      }
      stack.push(value2);
      let stepback = indent;
      indent = indent + gap;
      let partial = [];
      for (let i = 0; i < value2.length; i++) {
        const propertyString = serializeProperty(String(i), value2);
        partial.push(propertyString !== undefined ? propertyString : "null");
      }
      let final;
      if (partial.length === 0) {
        final = "[]";
      } else {
        if (gap === "") {
          let properties = partial.join(",");
          final = "[" + properties + "]";
        } else {
          let separator = ",\n" + indent;
          let properties = partial.join(separator);
          final = "[\n" + indent + properties + ",\n" + stepback + "]";
        }
      }
      stack.pop();
      indent = stepback;
      return final;
    }
  };
});

// node_modules/json5/lib/index.js
var require_lib = __commonJS((exports, module) => {
  var parse2 = require_parse();
  var stringify = require_stringify();
  var JSON5 = {
    parse: parse2,
    stringify,
  };
  module.exports = JSON5;
});

// node_modules/strip-bom/index.js
var require_strip_bom = __commonJS((exports, module) => {
  module.exports = (x) => {
    if (typeof x !== "string") {
      throw new TypeError("Expected a string, got " + typeof x);
    }
    if (x.charCodeAt(0) === 65279) {
      return x.slice(1);
    }
    return x;
  };
});

// node_modules/tsconfig-paths/lib/tsconfig-loader.js
var require_tsconfig_loader = __commonJS((exports) => {
  function tsConfigLoader(_a) {
    var { getEnv, cwd, loadSync: _b } = _a,
      loadSync = _b === undefined ? loadSyncDefault : _b;
    var TS_NODE_PROJECT = getEnv("TS_NODE_PROJECT");
    var TS_NODE_BASEURL = getEnv("TS_NODE_BASEURL");
    var loadResult = loadSync(cwd, TS_NODE_PROJECT, TS_NODE_BASEURL);
    return loadResult;
  }
  function loadSyncDefault(cwd, filename, baseUrl) {
    var configPath = resolveConfigPath(cwd, filename);
    if (!configPath) {
      return {
        tsConfigPath: undefined,
        baseUrl: undefined,
        paths: undefined,
      };
    }
    var config = loadTsconfig(configPath);
    return {
      tsConfigPath: configPath,
      baseUrl: baseUrl || (config && config.compilerOptions && config.compilerOptions.baseUrl),
      paths: config && config.compilerOptions && config.compilerOptions.paths,
    };
  }
  function resolveConfigPath(cwd, filename) {
    if (filename) {
      var absolutePath = fs.lstatSync(filename).isDirectory()
        ? path.resolve(filename, "./tsconfig.json")
        : path.resolve(cwd, filename);
      return absolutePath;
    }
    if (fs.statSync(cwd).isFile()) {
      return path.resolve(cwd);
    }
    var configAbsolutePath = walkForTsConfig(cwd);
    return configAbsolutePath ? path.resolve(configAbsolutePath) : undefined;
  }
  function walkForTsConfig(directory, readdirSync) {
    if (readdirSync === undefined) {
      readdirSync = fs.readdirSync;
    }
    var files = readdirSync(directory);
    var filesToCheck = ["tsconfig.json", "jsconfig.json"];
    for (var _i = 0, filesToCheck_1 = filesToCheck; _i < filesToCheck_1.length; _i++) {
      var fileToCheck = filesToCheck_1[_i];
      if (files.indexOf(fileToCheck) !== -1) {
        return path.join(directory, fileToCheck);
      }
    }
    var parentDirectory = path.dirname(directory);
    if (directory === parentDirectory) {
      return;
    }
    return walkForTsConfig(parentDirectory, readdirSync);
  }
  function loadTsconfig(configFilePath, existsSync, readFileSync) {
    if (existsSync === undefined) {
      existsSync = fs.existsSync;
    }
    if (readFileSync === undefined) {
      readFileSync = function (filename) {
        return fs.readFileSync(filename, "utf8");
      };
    }
    if (!existsSync(configFilePath)) {
      return;
    }
    var configString = readFileSync(configFilePath);
    var cleanedJson = StripBom(configString);
    var config;
    try {
      config = JSON5.parse(cleanedJson);
    } catch (e) {
      throw new Error("".concat(configFilePath, " is malformed ").concat(e.message));
    }
    var extendedConfig = config.extends;
    if (extendedConfig) {
      var base = undefined;
      if (Array.isArray(extendedConfig)) {
        base = extendedConfig.reduce(function (currBase, extendedConfigElement) {
          return mergeTsconfigs(
            currBase,
            loadTsconfigFromExtends(configFilePath, extendedConfigElement, existsSync, readFileSync)
          );
        }, {});
      } else {
        base = loadTsconfigFromExtends(configFilePath, extendedConfig, existsSync, readFileSync);
      }
      return mergeTsconfigs(base, config);
    }
    return config;
  }
  function loadTsconfigFromExtends(configFilePath, extendedConfigValue, existsSync, readFileSync) {
    var _a;
    if (typeof extendedConfigValue === "string" && extendedConfigValue.indexOf(".json") === -1) {
      extendedConfigValue += ".json";
    }
    var currentDir = path.dirname(configFilePath);
    var extendedConfigPath = path.join(currentDir, extendedConfigValue);
    if (
      extendedConfigValue.indexOf("/") !== -1 &&
      extendedConfigValue.indexOf(".") !== -1 &&
      !existsSync(extendedConfigPath)
    ) {
      extendedConfigPath = path.join(currentDir, "node_modules", extendedConfigValue);
    }
    var config = loadTsconfig(extendedConfigPath, existsSync, readFileSync) || {};
    if ((_a = config.compilerOptions) === null || _a === undefined ? undefined : _a.baseUrl) {
      var extendsDir = path.dirname(extendedConfigValue);
      config.compilerOptions.baseUrl = path.join(extendsDir, config.compilerOptions.baseUrl);
    }
    return config;
  }
  function mergeTsconfigs(base, config) {
    base = base || {};
    config = config || {};
    return __assign(__assign(__assign({}, base), config), {
      compilerOptions: __assign(__assign({}, base.compilerOptions), config.compilerOptions),
    });
  }
  var __assign =
    (exports && exports.__assign) ||
    function () {
      __assign =
        Object.assign ||
        function (t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
      return __assign.apply(this, arguments);
    };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.loadTsconfig = exports.walkForTsConfig = exports.tsConfigLoader = undefined;
  var path = __require("path");
  var fs = __require("fs");
  var JSON5 = require_lib();
  var StripBom = require_strip_bom();
  exports.tsConfigLoader = tsConfigLoader;
  exports.walkForTsConfig = walkForTsConfig;
  exports.loadTsconfig = loadTsconfig;
});

// node_modules/tsconfig-paths/lib/config-loader.js
var require_config_loader = __commonJS((exports) => {
  function loadConfig(cwd) {
    if (cwd === undefined) {
      cwd = process.cwd();
    }
    return configLoader({ cwd });
  }
  function configLoader(_a) {
    var { cwd, explicitParams, tsConfigLoader: _b } = _a,
      tsConfigLoader = _b === undefined ? TsConfigLoader2.tsConfigLoader : _b;
    if (explicitParams) {
      var absoluteBaseUrl = path.isAbsolute(explicitParams.baseUrl)
        ? explicitParams.baseUrl
        : path.join(cwd, explicitParams.baseUrl);
      return {
        resultType: "success",
        configFileAbsolutePath: "",
        baseUrl: explicitParams.baseUrl,
        absoluteBaseUrl,
        paths: explicitParams.paths,
        mainFields: explicitParams.mainFields,
        addMatchAll: explicitParams.addMatchAll,
      };
    }
    var loadResult = tsConfigLoader({
      cwd,
      getEnv: function (key) {
        return process.env[key];
      },
    });
    if (!loadResult.tsConfigPath) {
      return {
        resultType: "failed",
        message: "Couldn't find tsconfig.json",
      };
    }
    return {
      resultType: "success",
      configFileAbsolutePath: loadResult.tsConfigPath,
      baseUrl: loadResult.baseUrl,
      absoluteBaseUrl: path.resolve(path.dirname(loadResult.tsConfigPath), loadResult.baseUrl || ""),
      paths: loadResult.paths || {},
      addMatchAll: loadResult.baseUrl !== undefined,
    };
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.configLoader = exports.loadConfig = undefined;
  var TsConfigLoader2 = require_tsconfig_loader();
  var path = __require("path");
  exports.loadConfig = loadConfig;
  exports.configLoader = configLoader;
});

// node_modules/tsconfig-paths/lib/register.js
var require_register = __commonJS((exports) => {
  function getCoreModules(builtinModules) {
    builtinModules = builtinModules || [
      "assert",
      "buffer",
      "child_process",
      "cluster",
      "crypto",
      "dgram",
      "dns",
      "domain",
      "events",
      "fs",
      "http",
      "https",
      "net",
      "os",
      "path",
      "punycode",
      "querystring",
      "readline",
      "stream",
      "string_decoder",
      "tls",
      "tty",
      "url",
      "util",
      "v8",
      "vm",
      "zlib",
    ];
    var coreModules = {};
    for (var _i = 0, builtinModules_1 = builtinModules; _i < builtinModules_1.length; _i++) {
      var module_1 = builtinModules_1[_i];
      coreModules[module_1] = true;
    }
    return coreModules;
  }
  function register(params) {
    var cwd;
    var explicitParams;
    if (params) {
      cwd = params.cwd;
      if (params.baseUrl || params.paths) {
        explicitParams = params;
      }
    } else {
      var minimist = require_minimist();
      var argv = minimist(process.argv.slice(2), {
        string: ["project"],
        alias: {
          project: ["P"],
        },
      });
      cwd = argv.project;
    }
    var configLoaderResult = (0, config_loader_1.configLoader)({
      cwd: cwd !== null && cwd !== undefined ? cwd : process.cwd(),
      explicitParams,
    });
    if (configLoaderResult.resultType === "failed") {
      console.warn("".concat(configLoaderResult.message, ". tsconfig-paths will be skipped"));
      return noOp;
    }
    var matchPath = (0, match_path_sync_1.createMatchPath)(
      configLoaderResult.absoluteBaseUrl,
      configLoaderResult.paths,
      configLoaderResult.mainFields,
      configLoaderResult.addMatchAll
    );
    var Module = __require("module");
    var originalResolveFilename = Module._resolveFilename;
    var coreModules = getCoreModules(Module.builtinModules);
    Module._resolveFilename = function (request, _parent) {
      var isCoreModule = coreModules.hasOwnProperty(request);
      if (!isCoreModule) {
        var found = matchPath(request);
        if (found) {
          var modifiedArguments = __spreadArray([found], [].slice.call(arguments, 1), true);
          return originalResolveFilename.apply(this, modifiedArguments);
        }
      }
      return originalResolveFilename.apply(this, arguments);
    };
    return function () {
      Module._resolveFilename = originalResolveFilename;
    };
  }
  var __spreadArray =
    (exports && exports.__spreadArray) ||
    function (to, from, pack) {
      if (pack || arguments.length === 2)
        for (var i = 0, l = from.length, ar; i < l; i++) {
          if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
          }
        }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.register = undefined;
  var match_path_sync_1 = require_match_path_sync();
  var config_loader_1 = require_config_loader();
  var noOp = function () {
    return;
  };
  exports.register = register;
});

// node_modules/tsconfig-paths/lib/index.js
var require_lib2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.loadConfig =
    exports.register =
    exports.matchFromAbsolutePathsAsync =
    exports.createMatchPathAsync =
    exports.matchFromAbsolutePaths =
    exports.createMatchPath =
      undefined;
  var match_path_sync_1 = require_match_path_sync();
  Object.defineProperty(exports, "createMatchPath", {
    enumerable: true,
    get: function () {
      return match_path_sync_1.createMatchPath;
    },
  });
  Object.defineProperty(exports, "matchFromAbsolutePaths", {
    enumerable: true,
    get: function () {
      return match_path_sync_1.matchFromAbsolutePaths;
    },
  });
  var match_path_async_1 = require_match_path_async();
  Object.defineProperty(exports, "createMatchPathAsync", {
    enumerable: true,
    get: function () {
      return match_path_async_1.createMatchPathAsync;
    },
  });
  Object.defineProperty(exports, "matchFromAbsolutePathsAsync", {
    enumerable: true,
    get: function () {
      return match_path_async_1.matchFromAbsolutePathsAsync;
    },
  });
  var register_1 = require_register();
  Object.defineProperty(exports, "register", {
    enumerable: true,
    get: function () {
      return register_1.register;
    },
  });
  var config_loader_1 = require_config_loader();
  Object.defineProperty(exports, "loadConfig", {
    enumerable: true,
    get: function () {
      return config_loader_1.loadConfig;
    },
  });
});

// node_modules/tsconfig-paths-webpack-plugin/lib/options.js
var require_options = __commonJS((exports) => {
  function getOptions(rawOptions) {
    validateOptions(rawOptions);
    var options = makeOptions(rawOptions);
    return options;
  }
  function validateOptions(rawOptions) {
    var loaderOptionKeys = Object.keys(rawOptions);
    for (var i = 0; i < loaderOptionKeys.length; i++) {
      var option = loaderOptionKeys[i];
      var isUnexpectedOption = validOptions.indexOf(option) === -1;
      if (isUnexpectedOption) {
        throw new Error(
          "tsconfig-paths-webpack-plugin was supplied with an unexpected loader option: " +
            option +
            "\nPlease take a look at the options you are supplying; the following are valid options:\n" +
            validOptions.join(" / ") +
            "\n"
        );
      }
    }
  }
  function makeOptions(rawOptions) {
    var options = __assign(
      __assign(
        {},
        {
          configFile: "tsconfig.json",
          extensions: [".ts", ".tsx"],
          baseUrl: undefined,
          silent: false,
          logLevel: "WARN",
          logInfoToStdOut: false,
          context: undefined,
          colors: true,
          mainFields: ["main"],
          references: undefined,
        }
      ),
      rawOptions
    );
    var options2 = __assign(__assign({}, options), { logLevel: options.logLevel.toUpperCase() });
    return options2;
  }
  var __assign =
    (exports && exports.__assign) ||
    function () {
      __assign =
        Object.assign ||
        function (t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
      return __assign.apply(this, arguments);
    };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.getOptions = undefined;
  var validOptions = [
    "configFile",
    "extensions",
    "baseUrl",
    "silent",
    "logLevel",
    "logInfoToStdOut",
    "context",
    "mainFields",
    "references",
  ];
  exports.getOptions = getOptions;
});

// node_modules/tsconfig-paths-webpack-plugin/lib/logger.js
var require_logger = __commonJS((exports) => {
  function makeLogger(options, colors) {
    var logger = makeLoggerFunc(options);
    return {
      log: makeExternalLogger(options, logger),
      logInfo: makeLogInfo(options, logger, colors.green),
      logWarning: makeLogWarning(options, logger, colors.yellow),
      logError: makeLogError(options, logger, colors.red),
    };
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.makeLogger = undefined;
  var console_1 = __require("console");
  var LogLevel;
  (function (LogLevel2) {
    LogLevel2[(LogLevel2["INFO"] = 1)] = "INFO";
    LogLevel2[(LogLevel2["WARN"] = 2)] = "WARN";
    LogLevel2[(LogLevel2["ERROR"] = 3)] = "ERROR";
  })(LogLevel || (LogLevel = {}));
  var stderrConsole = new console_1.Console(process.stderr);
  var stdoutConsole = new console_1.Console(process.stdout);
  var doNothingLogger = function (_message) {};
  var makeLoggerFunc = function (options) {
    return options.silent
      ? function (_whereToLog, _message) {}
      : function (whereToLog, message) {
          return whereToLog.log(message);
        };
  };
  var makeExternalLogger = function (loaderOptions, logger) {
    return function (message) {
      return logger(loaderOptions.logInfoToStdOut ? stdoutConsole : stderrConsole, message);
    };
  };
  var makeLogInfo = function (options, logger, green) {
    return LogLevel[options.logLevel] <= LogLevel.INFO
      ? function (message) {
          return logger(options.logInfoToStdOut ? stdoutConsole : stderrConsole, green(message));
        }
      : doNothingLogger;
  };
  var makeLogError = function (options, logger, red) {
    return LogLevel[options.logLevel] <= LogLevel.ERROR
      ? function (message) {
          return logger(stderrConsole, red(message));
        }
      : doNothingLogger;
  };
  var makeLogWarning = function (options, logger, yellow) {
    return LogLevel[options.logLevel] <= LogLevel.WARN
      ? function (message) {
          return logger(stderrConsole, yellow(message));
        }
      : doNothingLogger;
  };
  exports.makeLogger = makeLogger;
});

// node_modules/tsconfig-paths-webpack-plugin/node_modules/enhanced-resolve/lib/getInnerRequest.js
var require_getInnerRequest2 = __commonJS((exports, module) => {
  module.exports = function getInnerRequest(resolver, request) {
    if (
      typeof request.__innerRequest === "string" &&
      request.__innerRequest_request === request.request &&
      request.__innerRequest_relativePath === request.relativePath
    )
      return request.__innerRequest;
    let innerRequest;
    if (request.request) {
      innerRequest = request.request;
      if (/^\.\.?(?:\/|$)/.test(innerRequest) && request.relativePath) {
        innerRequest = resolver.join(request.relativePath, innerRequest);
      }
    } else {
      innerRequest = request.relativePath;
    }
    request.__innerRequest_request = request.request;
    request.__innerRequest_relativePath = request.relativePath;
    return (request.__innerRequest = innerRequest);
  };
});

// node_modules/tsconfig-paths-webpack-plugin/lib/plugin.js
var require_plugin = __commonJS((exports) => {
  function loadConfig(configPath, logger) {
    var loadResult = TsconfigPaths.loadConfig(configPath);
    if (loadResult.resultType === "failed") {
      logger.logError("Failed to load " + configPath + ": " + loadResult.message);
    } else {
      logger.logInfo("tsconfig-paths-webpack-plugin: Using config file at " + loadResult.configFileAbsolutePath);
    }
    return loadResult;
  }
  function createPluginCallback(referenceMatchMap, baseMatchPath, resolver, baseAbsoluteBaseUrl, hook, extensions) {
    var fileExistAsync = createFileExistAsync(resolver.fileSystem);
    var readJsonAsync = createReadJsonAsync(resolver.fileSystem);
    return function (request, resolveContext, callback) {
      var _a, _b;
      var innerRequest = getInnerRequest(resolver, request);
      if (
        !innerRequest ||
        ((_a = request === null || request === undefined ? undefined : request.request) === null || _a === undefined
          ? undefined
          : _a.startsWith(".")) ||
        ((_b = request === null || request === undefined ? undefined : request.request) === null || _b === undefined
          ? undefined
          : _b.startsWith(".."))
      ) {
        return callback();
      }
      var absoluteBaseUrl = baseAbsoluteBaseUrl;
      if (typeof request.path === "string" && request.path !== baseAbsoluteBaseUrl) {
        if (referenceMatchMap[request.path]) {
          absoluteBaseUrl = request.path;
        } else {
          var referenceUrl = Object.keys(referenceMatchMap).find(function (refBaseUrl) {
            var relative = path.relative(refBaseUrl, request.path || "");
            return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
          });
          if (referenceUrl) {
            absoluteBaseUrl = referenceUrl;
          }
        }
      }
      var matchPath = referenceMatchMap[absoluteBaseUrl] || baseMatchPath;
      matchPath(innerRequest, readJsonAsync, fileExistAsync, extensions, function (err, foundMatch) {
        if (err) {
          return callback(err);
        }
        if (!foundMatch) {
          return callback();
        }
        var newRequest = __assign(__assign({}, request), { request: foundMatch, path: absoluteBaseUrl });
        var createInnerContext = require_createInnerContext2();
        return resolver.doResolve(
          hook,
          newRequest,
          "Resolved request '" + innerRequest + "' to '" + foundMatch + "' using tsconfig.json paths mapping",
          createInnerContext(__assign({}, resolveContext)),
          function (err2, result2) {
            if (err2) {
              return callback(err2);
            }
            if (result2 === undefined) {
              return callback(undefined, undefined);
            }
            callback(undefined, result2);
          }
        );
      });
    };
  }
  function createPluginLegacy(matchPath, resolver, absoluteBaseUrl, target, extensions) {
    var fileExistAsync = createFileExistAsync(resolver.fileSystem);
    var readJsonAsync = createReadJsonAsync(resolver.fileSystem);
    return function (request, callback) {
      var innerRequest = getInnerRequest(resolver, request);
      if (!innerRequest || innerRequest.startsWith(".") || innerRequest.startsWith("..")) {
        return callback();
      }
      matchPath(innerRequest, readJsonAsync, fileExistAsync, extensions, function (err, foundMatch) {
        if (err) {
          return callback(err);
        }
        if (!foundMatch) {
          return callback();
        }
        var newRequest = __assign(__assign({}, request), { request: foundMatch, path: absoluteBaseUrl });
        var createInnerCallback = require_createInnerCallback();
        return resolver.doResolve(
          target,
          newRequest,
          "Resolved request '" + innerRequest + "' to '" + foundMatch + "' using tsconfig.json paths mapping",
          createInnerCallback(function (err2, result2) {
            if (arguments.length > 0) {
              return callback(err2, result2);
            }
            callback(undefined, undefined);
          }, callback)
        );
      });
    };
  }
  function readJson(fileSystem, path2, callback) {
    if ("readJson" in fileSystem && fileSystem.readJson) {
      return fileSystem.readJson(path2, callback);
    }
    fileSystem.readFile(path2, function (err, buf) {
      if (err) {
        return callback(err);
      }
      var data;
      try {
        data = JSON.parse(buf.toString("utf-8"));
      } catch (e) {
        return callback(e);
      }
      return callback(undefined, data);
    });
  }
  function createReadJsonAsync(filesystem) {
    return function (path2, callback2) {
      readJson(filesystem, path2, function (err, json) {
        if (err || !json) {
          callback2();
          return;
        }
        callback2(undefined, json);
      });
    };
  }
  function createFileExistAsync(filesystem) {
    return function (path2, callback2) {
      filesystem.stat(path2, function (err, stats) {
        if (err) {
          callback2(undefined, false);
          return;
        }
        callback2(undefined, stats ? stats.isFile() : false);
      });
    };
  }
  var __assign =
    (exports && exports.__assign) ||
    function () {
      __assign =
        Object.assign ||
        function (t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
      return __assign.apply(this, arguments);
    };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TsconfigPathsPlugin = undefined;
  var chalk = require_source();
  var TsconfigPaths = require_lib2();
  var path = __require("path");
  var Options = require_options();
  var Logger = require_logger();
  var getInnerRequest = require_getInnerRequest2();
  var TsconfigPathsPlugin = (function () {
    function TsconfigPathsPlugin2(rawOptions) {
      var _this = this;
      if (rawOptions === undefined) {
        rawOptions = {};
      }
      this.source = "described-resolve";
      this.target = "resolve";
      var options = Options.getOptions(rawOptions);
      this.extensions = options.extensions;
      this.referenceMatchMap = {};
      this.log = Logger.makeLogger(options, new chalk.Instance({ level: options.colors ? undefined : 0 }));
      var context = options.context || process.cwd();
      var loadFrom = options.configFile || context;
      var loadResult = loadConfig(loadFrom, this.log);
      if (loadResult.resultType === "success") {
        this.baseUrl = options.baseUrl || loadResult.baseUrl;
        this.absoluteBaseUrl = options.baseUrl ? path.resolve(options.baseUrl) : loadResult.absoluteBaseUrl;
        this.matchPath = TsconfigPaths.createMatchPathAsync(this.absoluteBaseUrl, loadResult.paths, options.mainFields);
        if (options.references) {
          options.references.reduce(function (pathMap, reference) {
            if (reference) {
              var referenceResult = loadConfig(reference, _this.log);
              if (referenceResult.resultType === "success") {
                var { paths, absoluteBaseUrl } = referenceResult;
                pathMap[absoluteBaseUrl] = TsconfigPaths.createMatchPathAsync(
                  absoluteBaseUrl,
                  paths,
                  options.mainFields
                );
              }
            }
            return pathMap;
          }, this.referenceMatchMap);
        }
      }
    }
    TsconfigPathsPlugin2.prototype.apply = function (resolver) {
      if (!resolver) {
        this.log.logWarning(
          "tsconfig-paths-webpack-plugin: Found no resolver, not applying tsconfig-paths-webpack-plugin"
        );
        return;
      }
      if (!("fileSystem" in resolver)) {
        this.log.logWarning(
          "tsconfig-paths-webpack-plugin: No file system found on resolver." +
            " Please make sure you've placed the plugin in the correct part of the configuration." +
            " This plugin is a resolver plugin and should be placed in the resolve part of the Webpack configuration."
        );
        return;
      }
      if ("getHook" in resolver && typeof resolver.getHook === "function") {
        resolver
          .getHook(this.source)
          .tapAsync(
            { name: "TsconfigPathsPlugin" },
            createPluginCallback(
              this.referenceMatchMap,
              this.matchPath,
              resolver,
              this.absoluteBaseUrl,
              resolver.getHook(this.target),
              this.extensions
            )
          );
      } else if ("plugin" in resolver) {
        var legacyResolver = resolver;
        legacyResolver.plugin(
          this.source,
          createPluginLegacy(this.matchPath, resolver, this.absoluteBaseUrl, this.target, this.extensions)
        );
      }
    };
    return TsconfigPathsPlugin2;
  })();
  exports.TsconfigPathsPlugin = TsconfigPathsPlugin;
});

// node_modules/tsconfig-paths-webpack-plugin/lib/index.js
var require_lib3 = __commonJS((exports, module) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TsconfigPathsPlugin = undefined;
  var plugin_1 = require_plugin();
  Object.defineProperty(exports, "TsconfigPathsPlugin", {
    enumerable: true,
    get: function () {
      return plugin_1.TsconfigPathsPlugin;
    },
  });
  var plugin_2 = require_plugin();
  exports.default = plugin_2.TsconfigPathsPlugin;
  var theClass = require_plugin().TsconfigPathsPlugin;
  theClass.TsconfigPathsPlugin = plugin_2.TsconfigPathsPlugin;
  theClass.default = plugin_2.TsconfigPathsPlugin;
  module.exports = theClass;
});

// packages/jerni/src/dev-cli/getFilesToWatch.ts
var import_enhanced_resolve = __toESM(require_node(), 1);
import fs from "node:fs";
import path from "node:path";

// node_modules/es-module-lexer/dist/lexer.js
function parse(E, g = "@") {
  if (!C) return init.then(() => parse(E));
  const I = E.length + 1,
    w = (C.__heap_base.value || C.__heap_base) + 4 * I - C.memory.buffer.byteLength;
  w > 0 && C.memory.grow(Math.ceil(w / 65536));
  const K = C.sa(I - 1);
  if (((A ? B : Q)(E, new Uint16Array(C.memory.buffer, K, I)), !C.parse()))
    throw Object.assign(
      new Error(`Parse error ${g}:${E.slice(0, C.e()).split("\n").length}:${C.e() - E.lastIndexOf("\n", C.e() - 1)}`),
      { idx: C.e() }
    );
  const D = [],
    o = [];
  for (; C.ri(); ) {
    const A = C.is(),
      Q = C.ie(),
      B = C.it(),
      g2 = C.ai(),
      I2 = C.id(),
      w2 = C.ss(),
      K2 = C.se();
    let o2;
    C.ip() && (o2 = k(E.slice(I2 === -1 ? A - 1 : A, I2 === -1 ? Q + 1 : Q))),
      D.push({ n: o2, t: B, s: A, e: Q, ss: w2, se: K2, d: I2, a: g2 });
  }
  for (; C.re(); ) {
    const A = C.es(),
      Q = C.ee(),
      B = C.els(),
      g2 = C.ele(),
      I2 = E.slice(A, Q),
      w2 = I2[0],
      K2 = B < 0 ? undefined : E.slice(B, g2),
      D2 = K2 ? K2[0] : "";
    o.push({
      s: A,
      e: Q,
      ls: B,
      le: g2,
      n: w2 === '"' || w2 === "'" ? k(I2) : I2,
      ln: D2 === '"' || D2 === "'" ? k(K2) : K2,
    });
  }
  function k(A) {
    try {
      return (0, eval)(A);
    } catch (A2) {}
  }
  return [D, o, !!C.f(), !!C.ms()];
}
function Q(A, Q2) {
  const B = A.length;
  let C = 0;
  for (; C < B; ) {
    const B2 = A.charCodeAt(C);
    Q2[C++] = ((255 & B2) << 8) | (B2 >>> 8);
  }
}
function B(A, Q2) {
  const B2 = A.length;
  let C = 0;
  for (; C < B2; ) Q2[C] = A.charCodeAt(C++);
}
var ImportType;
(function (A) {
  (A[(A.Static = 1)] = "Static"),
    (A[(A.Dynamic = 2)] = "Dynamic"),
    (A[(A.ImportMeta = 3)] = "ImportMeta"),
    (A[(A.StaticSourcePhase = 4)] = "StaticSourcePhase"),
    (A[(A.DynamicSourcePhase = 5)] = "DynamicSourcePhase");
})(ImportType || (ImportType = {}));
var A = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
var C;
var init = WebAssembly.compile(
  ((E =
    "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"),
  typeof Buffer != "undefined" ? Buffer.from(E, "base64") : Uint8Array.from(atob(E), (A2) => A2.charCodeAt(0)))
)
  .then(WebAssembly.instantiate)
  .then(({ exports: A2 }) => {
    C = A2;
  });
var E;

// packages/jerni/src/dev-cli/getFilesToWatch.ts
var import_tsconfig_paths_webpack_plugin = __toESM(require_lib3(), 1);
async function getImportedModulesInFile(file) {
  const absoluteDir = path.dirname(file);
  const code = fs.readFileSync(file, "utf-8");
  await init;
  const [imports] = parse(code);
  const relativeImportPaths = imports.flatMap((importSpecifier) => (importSpecifier.n ? [importSpecifier.n] : []));

  const absoluteImportPaths = await Promise.allSettled(
    relativeImportPaths.map(async (relativeImportPath) => {
      const { promise, resolve, reject } = Promise.withResolvers();

      pathResolver.resolve({}, absoluteDir, relativeImportPath, {}, (err, result) => {
        if (err) {
          // console.warn(`Error resolving "${relativeImportPath}" in "${absoluteDir}"`);
          reject(err);
        } else {
          if (result) {
            resolve(result);
          } else {
            // console.warn(`Error resolving "${relativeImportPath}" in "${absoluteDir}"`);
            reject(new Error("No result"));
          }
        }
      });

      return promise;
    })
  ).then((results) => results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])));

  return absoluteImportPaths;
}
function isNodeModule(node) {
  return node.includes("node_modules");
}
var pathResolver = import_enhanced_resolve.ResolverFactory.createResolver({
  fileSystem: new import_enhanced_resolve.CachedInputFileSystem(fs, 4000),
  extensions: [".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".cts", ".mts", ".json"],
  plugins: [new import_tsconfig_paths_webpack_plugin.default({})],
});
async function getFilesToWatch(entryFile) {
  console.log("entryFile", entryFile);
  const rootFile = path.resolve(entryFile);
  const filesToWatch = [];
  const nodes = [rootFile];
  const visited = new Set();
  while (nodes.length > 0) {
    const node = nodes.pop();
    if (!node) {
      break;
    }

    if (visited.has(node)) {
      continue;
    }

    if (isNodeModule(node)) {
      continue;
    }
    visited.add(node);
    filesToWatch.push(node);
    const imported = await getImportedModulesInFile(node);
    nodes.push(...imported);
  }
  return filesToWatch;
}
export { getFilesToWatch as default };
