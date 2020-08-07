// @ts-ignore
import config from "config";
import { redis } from "../infrastructure/redis"; 
import socket from "socket.io";
import { SOCKET_CHANNEL } from "@src/infrastructure/utils/constants";

export function loadSocketService(io: socket.Server) {
  io.on("connection", function (socket: socket.Server) {
    console.log("a client is connected");
    socket.on(SOCKET_CHANNEL.CHAT_MESSAGE, (msg: string) => {
      io.emit(SOCKET_CHANNEL.CHAT_MESSAGE, msg);
    });
    // 媒体转换通知
    socket.on(SOCKET_CHANNEL.MEDIA_CONVERTED, async (msg: string) => {
      const {socketId, key, purpose}: {socketId:string, key:string, purpose:string} = JSON.parse(msg);
      const fileNameWithoutExt = key.split(".")[0].replace(config.AWS_MEDIA_CONVERT.videoSourceFolder, "");
      const data = await redis.get(config.AWS_MEDIA_CONVERT[ purpose + "_video_folder" ] + fileNameWithoutExt);
      if (data) {
        const decodedData = JSON.parse(data);
        decodedData.subscribers.push(socketId);
        await redis.set(config.AWS_MEDIA_CONVERT[ purpose + "_video_folder" ] + fileNameWithoutExt, JSON.stringify(decodedData));
      }
    });
  });
}