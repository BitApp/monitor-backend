import {Controller, GET} from "@src/infrastructure/decorators/koa";
import KoaRouter, {IRouterContext} from "koa-router";
import DialogueModel from "../models/dialogue";
import UserModel from "../models/user"
import MessageModel from "../models/message"
import {jsonResponse, unauthorized} from "@src/infrastructure/utils";
import {RESPONSE_CODE} from "@src/infrastructure/utils/constants";
import {AuthRequired} from "@src/infrastructure/decorators/auth";
import {PaginationDec} from "@src/infrastructure/decorators/pagination";
import {Pagination} from "@src/interface";

@Controller({prefix: "/dialogue"})
export default class UserController {

  @GET("/list")
  @AuthRequired()
  @PaginationDec()
  async getDialogues(ctx: IRouterContext, next: any) {
    const pagination = ctx.state.pagination;

    const dialogues = await DialogueModel.aggregate([
      {
        $lookup: {
          localField: "from",
          from: "users",
          foreignField: "uuid",
          as: "user"
        }
      },
      {
        $project: {
          _id: 0, "user._id": 0, "user.displayName": 1
        }
      },
    ]);
    console.log(dialogues);
    // const dialogues = (await DialogueModel.find({
    //   from: ctx.state.user.uuid,
    //   show: true
    // }, {_id: 0, to: 1})).map(item => {
    //   return item.to
    // });
    // const message = await MessageModel.find({
    //   $or: [
    //     {from: {$in: dialogues}, to: ctx.state.user.uuid},
    //     {from: ctx.state.user.uuid, to: {$in: dialogues}}
    //   ]
    // }, {_id: 0, from: 1, to: 1, createdAt: 1});
    // console.log(message)
    // const fields = {_id: 0, uuid: 1, name: 1, displayName: 1, avatar: 1, email: 1};
    // const user = await DialogueModel.g({uuid: ctx.params.id}, fields);
    ctx.body = jsonResponse({code: RESPONSE_CODE.NORMAL, data: dialogues})
  }

  @GET("/messages/:uuid")
  @AuthRequired()
  @PaginationDec()
  async messages(ctx: IRouterContext, next: any) {
    const pagination = ctx.state.pagination as Pagination;
    const fields = {_id: 0, from: 1, to: 1, content: 1, createdAt: 1, media: 1, medias: 1};
    const messages = await MessageModel.aggregate([
      {
        $lookup: {
          from: "medias",
          let: {media: "$media"},
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$media"],
                }
              }
            },
          ],
          as: 'medias'
        }
      },
      {
        $match: {
          $or: [
            {from: ctx.state.user.uuid, to: ctx.params.uuid},
            {from: ctx.params.uuid, to: ctx.state.user.uuid}
          ]
        }
      },
      {
        $project: fields
      },
      {$limit: pagination.limit},
      {$skip: pagination.offset},
      {$sort: {_id: -1}}
    ]);
    // const messages =  await MessageModel.find({
    //   $or: [
    //     {from: ctx.state.user.uuid, to: ctx.params.uuid},
    //     {from: ctx.params.uuid, to: ctx.state.user.uuid}
    //   ]
    // }, fields).limit(pagination.limit)
    //   .skip(pagination.offset)
    //   .sort({_id: -1});
    ctx.body = jsonResponse({code: RESPONSE_CODE.NORMAL, data: messages})
  }
}
