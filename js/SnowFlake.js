import bigInt from 'big-integer';
// http://peterolson.github.io/BigInteger.js/

/**
 * Twitter_Snowflake(雪花算法)
 *
 * SnowFlake的结构如下(共64bits，每部分用-分开):
 *   0 - 0000000000 0000000000 0000000000 0000000000 0 - 00000 - 00000 - 000000000000
 *   |   ----------------------|----------------------   --|--   --|--   -----|------
 * 1bit不用                41bit 时间戳                  数据标识id 机器id     序列号id
 *
 * - 1位标识，二进制中最高位为1的都是负数，但是我们生成的id一般都使用整数，所以这个最高位固定是0
 * - 41位时间截(毫秒级)，注意，41位时间截不是存储当前时间的时间截，而是存储时间截的差值（当前时间截 - 开始时间截得到的值），这里的的开始时间截，一般是我们的id生成器开始使用的时间，由我们程序来指定的（如下下面程序IdWorker类的startTime属性）。41位的时间截，可以使用69年，年T = (1L << 41) / (1000L * 60 * 60 * 24 * 365) = 69
 * - 10位的数据机器位，可以部署在1024个节点，包括5位datacenterId和5位workerId
 * - 12位序列，毫秒内的计数，12位的计数顺序号支持每个节点每毫秒(同一机器，同一时间截)产生4096个ID序号
 * - 加起来刚好64位，为一个Long型。
 * SnowFlake的优点是
 *   - 整体上按照时间自增排序
 *   - 并且整个分布式系统内不会产生ID碰撞(由数据中心ID和机器ID作区分)
 *   - 并且效率较高，经测试，SnowFlake每秒能够产生26万ID左右。
 */
export default class SnowFlake {
  constructor(_workerId, _dataCenterId, _sequence) {
    // 开始时间截 (2020-01-01)，这个可以设置开始使用该系统的时间，可往后使用69年
    this.twepoch = 1288834974657;
    this.workerIdBits = 5;
    this.dataCenterIdBits = 5;
    this.maxWrokerId = -1 ^ (-1 << this.workerIdBits); // 值为：31
    this.maxDataCenterId = -1 ^ (-1 << this.dataCenterIdBits); // 值为：31
    this.sequenceBits = 12;
    this.workerIdShift = this.sequenceBits; // 值为：12
    this.dataCenterIdShift = this.sequenceBits + this.workerIdBits; // 值为：17
    this.timestampLeftShift = this.sequenceBits + this.workerIdBits + this.dataCenterIdBits; // 值为：22
    this.sequenceMask = -1 ^ (-1 << this.sequenceBits); // 值为：4095
    this.lastTimestamp = -1;
    //设置默认值,从环境变量取
    this.workerId = 1;
    this.dataCenterId = 1;
    this.sequence = 0;
    if (this.workerId > this.maxWrokerId || this.workerId < 0) {
      throw new Error('config.worker_id must max than 0 and small than maxWrokerId-[' + this.maxWrokerId + ']');
    }
    if (this.dataCenterId > this.maxDataCenterId || this.dataCenterId < 0) {
      throw new Error('config.data_center_id must max than 0 and small than maxDataCenterId-[' + this.maxDataCenterId + ']');
    }
    this.workerId = _workerId;
    this.dataCenterId = _dataCenterId;
    this.sequence = _sequence;
  }
  tilNextMillis(lastTimestamp) {
    var timestamp = this.timeGen();
    while (timestamp <= lastTimestamp) {
      timestamp = this.timeGen();
    }
    return timestamp;
  }
  timeGen() {
    return Date.now();
  }
  nextId() {
    var timestamp = this.timeGen();
    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate id for ' +
        (this.lastTimestamp - timestamp));
    }
    if (this.lastTimestamp === timestamp) {
      this.sequence = (this.sequence + 1) & this.sequenceMask;
      if (this.sequence === 0) {
        timestamp = this.tilNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }
    this.lastTimestamp = timestamp;
    var shiftNum = (this.dataCenterId << this.dataCenterIdShift) |
      (this.workerId << this.workerIdShift) |
      this.sequence; // dataCenterId:1,workerId:1,sequence:0  shiftNum:135168
    var nfirst = new bigInt(String(timestamp - this.twepoch), 10);
    nfirst = nfirst.shiftLeft(this.timestampLeftShift);
    var nnextId = nfirst.or(new bigInt(String(shiftNum), 10)).toString(10);
    return nnextId;
  }
 /**
   * 获取更安全的随机ID(解决连续输出id会出现重复的问题)
   * 尽可能的避免重复
   * @param {int} repeatRate 重复率默认值100(注释:最小是1,最大值越大,重复的概率越低,不过还需要考虑性能的问题,并不是越大越好,只是相对而言)
   */
  guid(repeatRate = 100) {
    let arr = []
    let ranNum = Math.floor(window.crypto.getRandomValues(new Uint8Array(1)) * 0.001 * repeatRate)
    for (let index = 0; index < repeatRate; index++) {
      arr[index] = this.nextId()
    }
    return arr[ranNum]
  }
}
