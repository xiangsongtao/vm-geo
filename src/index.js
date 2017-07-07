/**
 * Created by Hsiang on 2017/5/8.
 *
 *
 * @property {object} options - options
 *
 * ## 特殊情况
 *
 * 默认我们的H5是在各种浏览器中运行, 通过H5的api或者是地图服务提供上提供的获取地理位置接口得到当前的经纬度.
 *
 * 如果运行在支付宝中, 则可以绕过以上方式, 使用支付宝提供的hybrid接口获取用户当前位置, 这样来说是比较快捷方便的.
 *
 * 因此, 如果在支付宝中, 则只是用支付宝方案获取地理位置信息.
 *
 *
 * ## 方法
 *
 * #### getCurrentPosition()
 *
 * 获取当前地理坐标, 默认使用h5模式, 也可以是: h5/qMap/bMap/aMap, 只能是这几个. 方法返回promise
 *
 * #### watchPosition()
 *
 * 订阅模式, 当位置坐标发生变化, 则触发回调. 使用此方法前需要先执行getCurrentPosition(). 方法返回订阅id
 *
 * ```
 * this.$geo.getCurrentPosition().then(() => {
 *    this.h5Timer = this.$geo.watchPosition((position) => {
 *       this.h5Geo = position
 *    })
 * })
 *
 * ```
 *
 * #### clearWatch(id)
 *
 * 取消订阅
 *
 */

const isString = (val) => typeof val === 'string'
const isFunction = (val) => typeof val === 'function'
const H5 = 'h5'
const ALIPAY = 'alipay'
const Q_MAP = 'qMap' // 腾讯地图
const B_MAP = 'bMap' // 百度地图
const A_MAP = 'aMap' // 高的地图(阿里地图)
const ERROR_TYPE = {
  1: 'PERMISSION_DENIED',
  2: 'POSITION_UNAVAILABLE',
  3: 'TIMEOUT'
}
const inBrowser = typeof window !== 'undefined'
class Geolocation {
  /**
   * @param {Object} options - 初始化的参数, 需要填入不同类型的Map信息
   * */
  constructor (options) {
    this._ua = window.navigator.userAgent.toLowerCase()
    // setting
    this._setting = {}
    // default
    this._default = {
      enableHighAccuracy: true, // 是否要求高精度地理位置信息
      maximumAge: 1000,         // 设置缓存时间为1s，1s后重新获取地理位置信息
      timeout: 5000,            // 5s未返回信息则返回错误
      fallBack: 'aMap',         // 条件允许优先使用原生获取, 如果在IOS下是使用的是HTTP获取, 则使用备选, 这里是aMap
      [Q_MAP]: {
        key: 'OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77', // official example app key, please use geo.register() to replace
        name: 'qqMapName'
      },
      [B_MAP]: {
        key: ''
      },
      [A_MAP]: {
        key: ''
      }
    }

    this._aMapGeolocation = null // aMap 方式获取地理位置的geolocation实例
    this._bMapGeolocation = null // bMap 方式获取地理位置的geolocation实例
    this._qMapGeolocation = null // qMap 方式获取地理位置的geolocation实例

    this.isHttps = window.location.protocol === 'https:'
    this.isSupported = !!window.navigator.geolocation
    this.isIos = this._ua.indexOf('iphone') > -1 || this._ua.indexOf('ipad') > -1

    // 参数合并
    Object.assign(this._setting, this._default, options)
  }

  /**
   * 获取地理位置
   * 如果没指定获取类型, 且在支付宝中则使用支付宝方案, 如果不是则使用H5方案
   * @param {string} [type] - map类型
   * @return {Promise}
   * */
  getCurrentPosition (type) {
    /**
     * 如果是在支付宝环境中, 则强制使用支付宝方案.
     * 需要实时计算
     * */
    let isAlipayReady = this._ua.indexOf('alipay') > -1 && window.AlipayJSBridge
    if (!type) {
      if (isAlipayReady) {
        type = ALIPAY
      } else {
        type = H5
      }
    }

    if (type === H5 && this.isIos && !this.isHttps) {
      type = this._setting.fallBack
      console.info(`[GEO]: 方法 getCurrentPosition() -> 如果在IOS下使用的不是HTTPS, 则使用备选方案'${type}'!`)
    }

    return new Promise((resolve, reject) => {
        /**
         * 成功的回调
         * */
      const successFn = (pos) => {
        let position = {}
        switch (type) {
          case H5:
            position = {lat: pos.coords.latitude, lng: pos.coords.longitude, mapType: H5, full: pos}
            break
          case A_MAP:
            position = {lat: pos.position.lat, lng: pos.position.lng, mapType: A_MAP, full: pos}
            break
          case B_MAP:
            position = {lat: pos.point.lat, lng: pos.point.lng, mapType: B_MAP, full: pos}
            break
          case Q_MAP:
            position = {lat: pos.lat, lng: pos.lng, mapType: Q_MAP, full: pos}
            break
          case ALIPAY:
            position = {lat: pos.latitude, lng: pos.longitude, mapType: ALIPAY, full: pos}
            break
          default:
            position = {lat: pos.position.lat, lng: pos.position.lng, mapType: A_MAP, full: pos}
            break
        }
        resolve(position)
      }

    /**
     * 失败的回调
     * */
      const errorFn = (err) => {
        let errType = Object.prototype.toString.call(err).match(/^(\[object )(\w+)\]$/i)[2].toLowerCase()
        if (errType === 'event') {
          console.warn(`[GEO]: 脚本加载错误 ${err.target.src}`)
          reject(err)
          return
        }

        if (errType === 'string') {
          console.warn(`[GEO]: ${err}`)
          reject(err)
          return
        }

        switch (type) {
          case H5:
          // alert(JSON.stringify(err))
            err = `[GEO]: CODE->${err.code}; INFO->${ERROR_TYPE[err.code]}; MESSAGE->${err.message}`
            console.warn(err)
            break
          case A_MAP:
            err = `[GEO]: INFO->${err.info}; MESSAGE->${err.message}`
            console.warn(err)
            break
          case B_MAP:
            err = `[GEO]: ${JSON.stringify(err)}`
            console.warn(err)
            break
          case Q_MAP:
            err = `[GEO]: ${JSON.stringify(err)}`
            console.warn(err)
            break
          default:
            err = `[GEO]: INFO->${err.info}; MESSAGE->${err.message}`
            console.warn(err)
            break
        }
        reject(err)
      }

    /**
     * 重新定义map需要的参数
     * */
      const posOptions = {
        enableHighAccuracy: this._setting.enableHighAccuracy,
        maximumAge: this._setting.maximumAge,
        timeout: this._setting.timeout
      }

      if (type === H5) {
        if (this.isSupported) {
          this._h5Location(successFn, errorFn, posOptions)
        } else {
          console.info(`[GEO]:当前设备不支持'window.navigator.geolocation', 这里使用备选方案'${this._setting.fallBack}'!`)
          this._useMapLocation(successFn, errorFn, posOptions, this._setting.fallBack)
        }
      } else if (type === ALIPAY) {
      // 使用alipay壳子的方案
        this._useAlipayLocation(successFn, errorFn, posOptions, type)
      } else {
        this._useMapLocation(successFn, errorFn, posOptions, type)
      }
    })
  }

  /**
   * 监听位置信息的改变，类似HTML5 Geolocation的watchPosition。
   * @param {String} [type=h5] - type
   * @param {Function} sucCallback - sucCallback为定位成功回调函数，必填。
   * @param {Function} errCallback - errCallback
   * @param {Function} options - options
   * @return {Number}
   * */
  watchPosition () {
    const noop = function () {}
    let type = ''
    let sucCallback = noop
    let errCallback = noop
    let options = {}

    /**
     * 重新定义map需要的参数
     * */
    const posOptions = {
      enableHighAccuracy: this._setting.enableHighAccuracy,
      maximumAge: this._setting.maximumAge,
      timeout: this._setting.timeout
    }

    let args = Array.from(arguments)

    if (isString(args[0]) && isFunction(args[1])) {
      type = args[0]
      sucCallback = args[1]
      args[2] && (errCallback = args[2])
      args[3] && (options = args[3])
    }

    if (isFunction(args[0])) {
      type = 'h5'
      sucCallback = args[0]
      args[1] && (errCallback = args[1])
      args[2] && (options = args[2])
    }

    options = Object.assign({}, posOptions, options)

    if (type === H5 && this.isIos && !this.isHttps) {
      type = this._setting.fallBack
      console.info('[MESSAGE]:WatchPosition() - > 如果在IOS下使用的不是HTTPS, 则使用备选方案\'' + type + '\'!')
    }

    /**
     * 成功的回调
     * */
    const successFn = (pos) => {
      let position = {}
      switch (type) {
        case H5:
          position = {lat: pos.coords.latitude, lng: pos.coords.longitude, mapType: H5, full: pos}
          break
        case A_MAP:
          position = {lat: pos.position.lat, lng: pos.position.lng, mapType: A_MAP, full: pos}
          break
        case B_MAP:
          position = {lat: pos.point.lat, lng: pos.point.lng, mapType: B_MAP, full: pos}
          break
        case Q_MAP:
          position = {lat: pos.lat, lng: pos.lng, mapType: Q_MAP, full: pos}
          break
        default:
          position = {lat: pos.position.lat, lng: pos.position.lng, mapType: A_MAP, full: pos}
          break
      }
      sucCallback && sucCallback(position)
    }

    /**
     * 失败的回调
     * */
    const errorFn = (err) => {
      let errType = Object.prototype.toString.call(err).match(/^(\[object )(\w+)\]$/i)[2].toLowerCase()
      if (errType === 'event') {
        console.warn(`[GEO]: 脚本加载错误 ${err.target.src}`)
        errCallback && errCallback(err)
        return
      }

      if (errType === 'string') {
        console.warn(`[GEO]: ${err}`)
        errCallback && errCallback(err)
        return
      }

      switch (type) {
        case H5:
          err = `[GEO]: CODE->${err.code}; TYPE->${ERROR_TYPE[err.code]}; MESSAGE->${err.message}`
          console.warn(err)
          break
        case A_MAP:
          err = `[GEO]: INFO->${err.info}; MESSAGE->${err.message}`
          console.warn(err)
          break
        case B_MAP:
          err = `[GEO]: ${JSON.stringify(err)}`
          console.warn(err)
          break
        case Q_MAP:
          err = `[GEO]: ${JSON.stringify(err)}`
          console.warn(err)
          break
        default:
          err = `[GEO]: INFO->${err.info}; MESSAGE->${err.message}`
          console.warn(err)
          break
      }
      errCallback && errCallback(err)
    }

    let watchId = null
    if (this._setting[type] && this._setting[type].key) {
      switch (type) {
        case H5:
          watchId = window.navigator.geolocation.watchPosition(successFn, errorFn, options)
          break
        case A_MAP:
          watchId = this._aMapWatchLocation(successFn, errorFn, options)
          break
        case B_MAP:
          console.error('百度地图并未提供 watchPosition() 方法, 请切换其他方式!')
          break
        case Q_MAP:
          watchId = this._qMapWatchLocation(successFn, errorFn, options)
          break
        default:
          watchId = this._aMapWatchLocation(successFn, errorFn, options)
          break
      }
    } else {
      errCallback && errCallback(`必须要为地图类型'${type}'提供key!`)
    }
    return watchId
  }

  /**
   * 清除监听，类似HTML5 Geolocation的clearWatch。
   * */
  clearWatch (id) {
    if (!id) return
    window.navigator.geolocation.clearWatch(id)
    this._aMapGeolocation && this._aMapGeolocation.clearWatch(id)
    this._qMapGeolocation && this._qMapGeolocation.clearWatch(id)
  }

  // -------- private --------

  /**
   * 使用 aMap 模式进行 watchPosition()
   * @param {Function} sucCallback  - 成功回调
   * @param {Function} errCallback    - 失败回调
   * @param {Object} options   - 配置参数
   * @private
   * */
  _aMapWatchLocation (sucCallback, errCallback, options = {}) {
    if (this._aMapGeolocation) {
      return this._aMapGeolocation.watchPosition(sucCallback, errCallback, options)
    } else {
      console.warn('实例 aMapGeolocation 未定义, 在使用 watchPosition() 之前先获取一次本地位置 getCurrentPosition(), 成功后再进行 watchPosition()!')
      this._aMapLocation(sucCallback, errCallback, options)
      return 0
    }
  }

  /**
   * 使用 qMap 模式进行 watchPosition()
   * @param {Function} sucCallback  - 成功回调
   * @param {Function} errCallback    - 失败回调
   * @param {Object} options   - 配置参数
   * @private
   * */
  _qMapWatchLocation (sucCallback, errCallback, options = {}) {
    if (this._qMapGeolocation) {
      return this._qMapGeolocation.watchPosition(sucCallback, errCallback, options)
    } else {
      console.warn('实例 qMapWatchLocation 未定义, 在使用 watchPosition() 之前先获取一次本地位置 getCurrentPosition(), 成功后再进行 watchPosition()!')
      this._qMapLocation(sucCallback, errCallback, options)
      return 0
    }
  }

  /**
   * 使用alipay壳子的方案
   * @param {Function} sucCallback  - 成功回调
   * @param {Function} errCallback    - 失败回调
   * @param {Object} options   - 配置参数
   * @private
   * */
  _useAlipayLocation (sucCallback, errCallback) {
    window.AlipayJSBridge && window.AlipayJSBridge.call('getLocation', function (result) {
      if (result.error) {
        errCallback(result.errorMessage)
        return
      }
      // 四个直辖市（北京，上海，重庆，天津）返回的city为空字符串，可以通过result.province来获取，所以建议result.city?result.city:result.province这样来获取city
      sucCallback(result)
    })
  }

  /**
   * 使用 地图 模式获取地理位置信息
   * @param {Function} successFn  - 成功回调
   * @param {Function} errorFn    - 失败回调
   * @param {Object} posOptions   - 配置参数
   * @param {string} type         - map类型
   * @private
   * */
  _useMapLocation (successFn, errorFn, posOptions = {}, type) {
    if (this._setting[type].key) {
      switch (type) {
        case A_MAP:
          this._aMapLocation(successFn, errorFn, posOptions)
          break
        case B_MAP:
          this._bMapLocation(successFn, errorFn, posOptions)
          break
        case Q_MAP:
          this._qMapLocation(successFn, errorFn, posOptions)
          break
        default:
          this._aMapLocation(successFn, errorFn, posOptions)
          break
      }
    } else {
      errorFn('The map type of \'' + type + '\' must have key!')
    }
  }

  /**
   * 使用 aMap 模式获取地理位置信息
   * @param {Function} successFn  - 成功回调
   * @param {Function} errorFn    - 失败回调
   * @param {Object} posOptions   - 配置参数
   * @see http://lbs.amap.com/api/javascript-api/reference/location/
   * @private
   * */
  _aMapLocation (successFn, errorFn, posOptions = {}) {
    let _getCurrentPosition = () => {
      this._aMapGeolocation.getCurrentPosition((status, result) => {
        if (status === 'complete') {
          successFn && successFn(result)
        } else {
          errorFn && errorFn(status)
        }
      })
    }

    if (!this._aMapGeolocation) {
      this._getScript('https://webapi.amap.com/maps?v=1.3&key=' + this._setting[A_MAP].key).then(() => {
        try {
          let map = new window.AMap.Map('')
          map.plugin('AMap.Geolocation', () => {
          /**
           * @param {object} posOptions - 传入参数
           * @param {boolean} [posOptions.enableHighAccuracy=true] - 是否使用高精度定位，默认:true
           * @param {number} [posOptions.timeout=10000] - 超过10秒后停止定位，默认：无穷大
           * @param {number} 9posOptions.maximumAge=00 - 定位结果缓存0毫秒，默认：0
           * */
            this._aMapGeolocation = new window.AMap.Geolocation(posOptions)
            _getCurrentPosition()
          })
        } catch (err) {
          errorFn && errorFn(err)
        }
      }, (err) => { errorFn && errorFn(err) })
    } else {
      _getCurrentPosition()
    }
  }

  /**
   * 使用 bMap 模式获取地理位置信息
   * @param {Function} successFn  - 成功回调
   * @param {Function} errorFn    - 失败回调
   * @param {Object} posOptions   - 配置参数
   * @see http://developer.baidu.com/map/reference/index.php?title=Class:%E6%9C%8D%E5%8A%A1%E7%B1%BB/Geolocation
   * @private
   * */
  _bMapLocation (successFn, errorFn, posOptions = {}) {
    let _getCurrentPosition = () => {
      this._bMapGeolocation.getCurrentPosition(function (pos) {
        if (this.getStatus() === window.BMAP_STATUS_SUCCESS) {
          successFn && successFn(pos)
        } else {
          errorFn && errorFn(this.getStatus())
        }
      }, posOptions)
    }

    if (!this._bMapGeolocation) {
      this._getScript('https://api.map.baidu.com/getscript?v=2.0&ak=' + this._setting[B_MAP].key + '&services=&t=' + (+new Date())).then(() => {
        try {
          this._bMapGeolocation = new window.BMap.Geolocation()
          _getCurrentPosition()
        } catch (err) {
          errorFn && errorFn(err)
        }
      }, (err) => { errorFn && errorFn(err) })
    } else {
      _getCurrentPosition()
    }
  }

  /**
   * 使用 qMap 模式获取地理位置信息
   * @param {Function} successFn  - 成功回调
   * @param {Function} errorFn    - 失败回调
   * @param {Object} posOptions   - 配置参数
   * @see http://lbs.qq.com/tool/component-geolocation.html
   * @private
   * */
  _qMapLocation (successFn, errorFn, posOptions = {}) {
    let _getCurrentPosition = () => {
      this._qMapGeolocation.getLocation(successFn, errorFn, {
        timeout: posOptions.timeout
      })
    }

    if (!this._qMapGeolocation) {
      this._getScript('https://3gimg.qq.com/lightmap/components/geolocation/geolocation.min.js').then(() => {
        /**
         * Geolocation
         * @params {string} key - 开发密钥(key)
         * @params {string} referer - 调用来源，一般为您的应用名称
         * */
        try {
          this._qMapGeolocation = new window.qq.maps.Geolocation(this._setting[Q_MAP].key, this._setting[Q_MAP].name)
          _getCurrentPosition()
        } catch (err) {
          errorFn && errorFn(err)
        }
      }, (err) => { errorFn && errorFn(err) })
    } else {
      _getCurrentPosition()
    }
  }

  /**
   * 使用 H5 模式获取地理位置信息
   * @param {Function} successFn  - 成功回调
   * @param {Function} errorFn    - 失败回调
   * @param {Object} posOptions   - 配置参数
   * @private
   * */
  _h5Location (successFn, errorFn, posOptions = {}) {
    window.navigator.geolocation.getCurrentPosition(successFn, errorFn, posOptions)
  }

  /**
   * 获取脚本
   * @param  {[String]} mapJsUrl [map js url]
   * @return {Promise}
   * @private
   */
  _getScript (mapJsUrl) {
    return new Promise((resolve, reject) => {
      let sc = document.createElement('script')
      sc.type = 'text/javascript'
      sc.src = mapJsUrl
      sc.onload = sc.onreadystatechange = function () {
        if (!this.readyState || /^(loaded|complete)$/.test(this.readyState)) {
          resolve()
          sc.onload = sc.onreadystatechange = null
        }
      }
      sc.onerror = function (err) {
        reject(err)
        sc.onerror = null
      }
      document.body.appendChild(sc)
    })
  }
}

const install = (Vue, options) => {
  if (install.installed) return
  Object.defineProperty(Vue.prototype, '$geo', {
    get () { return new Geolocation(options) }
  })
  install.installed = true
}
const geolocation = {
  version: VERSION,
  install
}

module.exports = geolocation
