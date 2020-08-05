// @ts-ignore
import config from "config";
import { Controller, POST } from "@src/infrastructure/decorators/koa";
import { IRouterContext } from "koa-router";
import { redis } from "@src/infrastructure/redis";
import { getSocketIO } from "@src/infrastructure/socket";
import { SOCKET_CHANNEL } from "@src/infrastructure/utils/constants";


// todo: need to verity the signatures of Amazon SNS messages
@Controller({ prefix: "/callback" })
export default class CallbackController {
  @POST("/mediaconvertcomplete/notification")
  async notify(ctx: IRouterContext) {
    const body = ctx.request.body;
    const message = JSON.parse(body.Message);
    const records = message.Records;
    for(let recordItem of records){
      const fileName = recordItem.s3.object.key;
      const key = fileName.split("_")[0];
      const data = await redis.get(key);
      if (data) {
        const decodedData = JSON.parse(data);
        if (decodedData.fileCount > 0) {
          decodedData.fileCount --;
        } else {
          // all files have been converted successfully
          // 这里需要根据类型入库
          // 转换成功发送给订阅者
          console.log(decodedData.subscribers);
          if (decodedData.subscribers.length) {
            const io = getSocketIO();
            const fileName = decodedData.fileName;
            const fileNameWithoutExt = fileName.split(".")[0];
            
            for(let socketId of decodedData.subscribers){
              io.sockets.connected[socketId].emit(SOCKET_CHANNEL.MEDIA_CONVERTED, {
                fileName,
                screenshot: config.AWS_S3.prefix + fileNameWithoutExt + config.AWS_S3.screenshot_suffix,
                low: config.AWS_S3.prefix + fileNameWithoutExt + config.AWS_S3.low_suffix,
                hd: config.AWS_S3.prefix + fileNameWithoutExt + config.AWS_S3.hd_suffix
              });
            }
          }
        }
      }
    }
  }
}