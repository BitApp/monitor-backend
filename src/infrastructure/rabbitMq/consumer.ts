import {Connection, connect, Channel, Options} from "amqplib"
import {RABBITMQ_EXCHANGE_TYPE} from "../utils/constants";

export class Consumer {
  connect?: Connection;
  channel?: Channel;
  routingKey: string;
  exchangeName: string;
  queueName: string;

  constructor(queueName: string, routingKey: string, exchangeName: string) {
    this.queueName = queueName;
    this.routingKey = routingKey;
    this.exchangeName = exchangeName;
  }

  async connection(url: string, exchangeType?: RABBITMQ_EXCHANGE_TYPE, options?: Options.AssertExchange) {
    // new connection
    this.connect = await connect(url);
    // new channel
    this.channel = await this.connect.createChannel();
    // defined exchange
    await this.channel.assertExchange(this.exchangeName, exchangeType || RABBITMQ_EXCHANGE_TYPE.DIRECT, options);
    // defined queue
    await this.channel.assertQueue(this.queueName);
    // binding
    await this.channel.bindQueue(this.queueName, this.exchangeName, this.routingKey);

  }

  async publish(msg: string) {
    await this.channel!.publish(this.exchangeName, this.routingKey, Buffer.from(msg))
  }

  async consume(cb: (msg: string) => void) {
    await this.channel!.consume(this.queueName, msg => {
      if (msg) {
        cb(msg.content.toString());
        this.channel!.ack(msg)
      }
    })
  }

  async close() {
    await this.channel!.close();
    await this.connect!.close();
  }
}

